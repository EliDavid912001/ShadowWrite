const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const { runSimulationEngine, formatChatError, CHAT_MODEL } = require('./server/simulation-engine');
const { runScenario, formatScenarioError, GEMINI_MODEL } = require('./server/scenario-engine');
const { runCoachFeedback, formatCoachError } = require('./server/coach-engine');
const { validateSimSessionBody } = require('./server/schema/simulator-session');
const promptManager = require('./server/promptManager');
const { runAlphaSimTurn, runAlphaSimSummary } = require('./server/alpha-simulator');

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
      }
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  })
);

const groqKey = process.env.GROQ_API_KEY?.trim();
const geminiKey = process.env.GEMINI_API_KEY?.trim();

if (!geminiKey) {
  console.error('❌ ERROR: GEMINI_API_KEY is missing — /api/scenario will fail');
} else {
  console.log('✅ Gemini key (4 answers + chat + coach): ' + geminiKey.substring(0, 7) + '...');
}

if (!groqKey) {
  console.warn('⚠️ GROQ_API_KEY missing — alpha-sim only (optional)');
} else {
  console.log('✅ Groq key (alpha-sim): ' + groqKey.substring(0, 7) + '...');
}

console.log(
  `✅ Routes: /api/scenario (${GEMINI_MODEL}) | /api/chat (${CHAT_MODEL}) | /api/feedback (Gemini coach)`
);
console.log('✅ Prompt rules: promptManager.js');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function groqHeaders() {
  return {
    Authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}`,
    'Content-Type': 'application/json'
  };
}

function parseGroqJson(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function getChatHistoryFromBody(body) {
  if (Array.isArray(body.chat_history)) return body.chat_history;
  if (Array.isArray(body.chatHistory)) return body.chatHistory;
  return [];
}

/** Maya chat — Gemini + promptManager SIMULATOR_PROMPT */
async function handleChat(req, res) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return res.status(500).json({
      error: 'מפתח Gemini לא מוגדר — הוסף GEMINI_API_KEY ל-.env'
    });
  }

  const situation = String(req.body.situation || req.body.message || '').trim();
  if (!situation) {
    return res.status(400).json({ error: 'חסרה הודעה' });
  }

  const session = validateSimSessionBody(req.body);
  if (!session.ok) {
    return res.status(400).json({ error: session.error });
  }

  try {
    const text = await runSimulationEngine(
      getChatHistoryFromBody(req.body),
      situation,
      session.difficulty
    );
    const reply = String(text || '').trim() || 'חחח אוקיי';
    console.log('[api/chat] reply:', reply.slice(0, 80), 'diff:', session.difficulty);
    res.json({ response: reply, difficulty: session.difficulty });
  } catch (err) {
    console.error('[api/chat] error:', err.message);
    const errMsg = formatChatError(err);
    if (err.isRateLimit) {
      return res.status(429).json({ error: `מכסת Gemini — נסה שוב. (${errMsg})` });
    }
    res.status(500).json({ error: errMsg || 'שגיאה בצ׳אט' });
  }
}

app.post('/api/chat', handleChat);
app.post('/api/simulate/chat', handleChat);

async function handleCoachFeedback(req, res) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'מפתח Gemini לא מוגדר — הוסף GEMINI_API_KEY ל-.env' });
  }

  const history = getChatHistoryFromBody(req.body);
  const session = validateSimSessionBody(req.body);
  if (!session.ok) {
    return res.status(400).json({ error: session.error });
  }

  try {
    const report = await runCoachFeedback(history, session.difficulty);
    res.json({
      score: report.score,
      analysis: report.analysis,
      improvements: report.improvements,
      feedback: report.analysis,
      difficulty: session.difficulty
    });
  } catch (err) {
    console.error('[api/feedback] error:', err.message);
    const errMsg = formatCoachError(err);
    if (err.isRateLimit) {
      return res.status(429).json({ error: `מכסת Gemini — נסה שוב. (${errMsg})` });
    }
    if (err.message?.includes('2 הודעות')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: errMsg || 'שגיאה ביצירת הסיכום' });
  }
}

app.post('/api/feedback', handleCoachFeedback);

/** Maya chat end button — Gemini coach (legacy path alias) */
app.post('/api/session/analyze', handleCoachFeedback);

async function handleScenario(req, res) {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return res.status(500).json({ error: 'מפתח Gemini לא מוגדר בשרת — הוסף GEMINI_API_KEY ל-.env' });
  }

  const situation = String(
    req.body.situation ?? req.body.message ?? req.body.text ?? ''
  ).trim();

  if (!situation) {
    return res.status(400).json({ error: 'חסרה סיטואציה' });
  }

  const channel = ['app', 'whatsapp'].includes(req.body.channel)
    ? req.body.channel
    : 'app';

  const stage = req.body.stage ?? req.body.relationshipStage ?? 'start';
  const isVIP = req.body.isVIP === true || req.body.isVip === true;

  console.log('[api/scenario] request:', {
    situation: situation.slice(0, 80),
    channel,
    stage,
    isVIP
  });

  try {
    const responses = await runScenario(situation, channel, stage, { isVIP });
    console.log('[api/scenario] ok:', {
      alpha: responses.alpha?.slice(0, 40),
      beta: responses.beta?.slice(0, 40)
    });
    res.json({ success: true, responses, channel });
  } catch (err) {
    console.error('[api/scenario] error:', err);
    if (err.stack) console.error(err.stack);

    const errMsg = formatScenarioError(err);
    if (err.isRateLimit || err.response?.status === 429) {
      return res.status(429).json({
        error: `מכסת Gemini — נסה שוב בעוד כמה דקות. (${errMsg})`
      });
    }
    if (/404|not found|לא זמין/i.test(errMsg)) {
      return res.status(502).json({ error: errMsg });
    }
    if (errMsg.includes('API key') || errMsg.includes('API_KEY') || err.response?.status === 401) {
      return res.status(401).json({ error: 'מפתח Gemini לא תקין' });
    }
    res.status(500).json({
      error: `שגיאה ביצירת 4 התשובות: ${errMsg}`
    });
  }
}

app.post('/api/scenario', handleScenario);

/** Legacy alias for 4-answers clients */
app.post('/api/analyze', async (req, res) => {
  const hist = getChatHistoryFromBody(req.body);
  if (hist.length > 0) return handleChat(req, res);
  return handleScenario(req, res);
});

app.post('/api/analyze/summary', handleCoachFeedback);

// ── Alpha Training simulator (נפרד מסימולציית מאיה) ──
function alphaSimMissingKey(res) {
  return res.status(500).json({ error: 'המפתח לא מוגדר בשרת — בדוק .env' });
}

function groqErrorMessage(err) {
  const data = err.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return err.message || 'שגיאה במנוע הסימולציה';
}

async function handleAlphaTurn(req, res) {
  if (!process.env.GROQ_API_KEY?.trim()) return alphaSimMissingKey(res);

  const userReply = String(req.body.userReply || req.body.message || '').trim();
  if (!userReply) {
    return res.status(400).json({ error: 'חסרה תגובה' });
  }

  try {
    const parsed = await runAlphaSimTurn(getChatHistoryFromBody(req.body), userReply);
    res.json({
      success: true,
      isBeta: parsed.isBeta,
      analysis: parsed.analysis,
      reframeHint: parsed.isBeta ? parsed.reframeHint || 'קצר. ערס. מוביל — בלי להתנצל.' : '',
      nextGirlReply: parsed.isBeta ? '' : parsed.nextGirlReply,
      engine: 'alpha-sim-v3'
    });
  } catch (err) {
    console.error('Alpha turn Error:', err.response?.data || err.message);
    res.status(500).json({ error: groqErrorMessage(err) });
  }
}

async function handleAlphaSummary(req, res) {
  if (!process.env.GROQ_API_KEY?.trim()) return alphaSimMissingKey(res);

  const history = getChatHistoryFromBody(req.body);
  const userTurns = history.filter((m) => m.role === 'user').length;
  if (userTurns < 2) {
    return res.status(400).json({ error: 'שלח לפחות 2 הודעות לפני סיכום' });
  }

  try {
    const report = await runAlphaSimSummary(history);
    res.json({ success: true, report, engine: 'alpha-summary-v1' });
  } catch (err) {
    console.error('Alpha summary Error:', err.response?.data || err.message);
    res.status(500).json({ error: groqErrorMessage(err) });
  }
}

app.post('/api/alpha-sim/turn', handleAlphaTurn);
app.post('/api/alpha-sim/summary', handleAlphaSummary);
app.post('/api/simulate', handleAlphaTurn);
app.post('/api/simulate/summary', handleAlphaSummary);
app.post('/api/alpha-sim', handleAlphaTurn);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Matrix Active', hasKey: Boolean(process.env.GROQ_API_KEY) });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Matrix Active on port ${PORT}`);
});
