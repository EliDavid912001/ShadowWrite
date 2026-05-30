const express = require('express');
const { runSimulationEngine, formatChatError } = require('../simulation-engine');
const { runCoachFeedback, formatCoachError } = require('../coach-engine');
const { validateSimSessionBody } = require('../schema/simulator-session');
const { runAlphaSimTurn, runAlphaSimSummary } = require('../alpha-simulator');

const router = express.Router();

function getChatHistoryFromBody(body) {
  if (Array.isArray(body.chat_history)) return body.chat_history;
  if (Array.isArray(body.chatHistory)) return body.chatHistory;
  return [];
}

function alphaSimMissingKey(res) {
  return res.status(500).json({ error: 'המפתח לא מוגדר בשרת — בדוק .env' });
}

function groqErrorMessage(err) {
  const data = err.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data?.error === 'string') return data.error;
  return err.message || 'שגיאה במנוע הסימולציה';
}

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
    res.json({ response: reply, difficulty: session.difficulty });
  } catch (err) {
    console.error('[api/chat]', err.message);
    const errMsg = formatChatError(err);
    if (err.isRateLimit) {
      return res.status(429).json({ error: `מכסת Gemini — נסה שוב. (${errMsg})` });
    }
    res.status(500).json({ error: errMsg || 'שגיאה בצ׳אט' });
  }
}

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
    console.error('[api/feedback]', err.message);
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
    console.error('[alpha-sim/turn]', err.response?.data || err.message);
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
    console.error('[alpha-sim/summary]', err.response?.data || err.message);
    res.status(500).json({ error: groqErrorMessage(err) });
  }
}

router.post('/api/chat', handleChat);
router.post('/api/simulate/chat', handleChat);
router.post('/api/feedback', handleCoachFeedback);
router.post('/api/session/analyze', handleCoachFeedback);
router.post('/api/analyze', async (req, res) => {
  const hist = getChatHistoryFromBody(req.body);
  if (hist.length > 0) return handleChat(req, res);
  const { handleGenerateScript } = require('./generate-script');
  return handleGenerateScript(req, res);
});
router.post('/api/analyze/summary', handleCoachFeedback);
router.post('/api/alpha-sim/turn', handleAlphaTurn);
router.post('/api/alpha-sim/summary', handleAlphaSummary);
router.post('/api/simulate', handleAlphaTurn);
router.post('/api/simulate/summary', handleAlphaSummary);
router.post('/api/alpha-sim', handleAlphaTurn);

module.exports = router;
