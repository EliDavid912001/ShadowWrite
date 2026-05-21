const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

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

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('❌ ERROR: GROQ_API_KEY is missing from .env file!');
} else {
  console.log('✅ API Key detected: ' + apiKey.substring(0, 7) + '...');
  console.log('✅ Analyze engine v4 (Ars-Lite + few-shot)');
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const {
  buildAnalyzeMessages,
  sanitizeResponses,
  enforceAlphaRules,
  responsesLookRobotic
} = require('./server/prompts/archetypes');

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

// ── 4 Archetypes ──────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  const { situation, channel } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'המפתח לא מוגדר בשרת' });
  }
  if (!situation || !String(situation).trim()) {
    return res.status(400).json({ error: 'חסרה סיטואציה' });
  }

  async function callAnalyze(strictRetry) {
    const messages = buildAnalyzeMessages(situation, channel);
    if (strictRetry) {
      messages.push({
        role: 'user',
        content:
          'RETRY: התשובה הקודמת הייתה רובוטית או העתיקה דוגמאות. כתוב מחדש מותאם לסיטואציה. אלפא בלי סימן שאלה. עברית מדוברת בלבד.'
      });
    }
    const response = await axios.post(
      GROQ_URL,
      {
        model: GROQ_MODEL,
        messages,
        temperature: strictRetry ? 0.35 : 0.15,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      },
      { headers: groqHeaders() }
    );
    return sanitizeResponses(parseGroqJson(response.data.choices[0].message.content));
  }

  try {
    let parsed = await callAnalyze(false);
    if (!parsed.alpha || !parsed.beta || !parsed.witty || !parsed.friendly) {
      throw new Error('תשובה לא שלמה מה-AI');
    }
    if (responsesLookRobotic(parsed)) {
      console.warn('Analyze: robotic output, retrying...');
      parsed = await callAnalyze(true);
    }
    parsed = enforceAlphaRules(String(situation).trim(), parsed);

    res.json({ success: true, responses: parsed, channel: channel || 'app', engine: 'v4-ars' });
  } catch (err) {
    console.error('API Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'שגיאה בעיבוד הנתונים' });
  }
});

// ── מנוע הסימולטור VIP ───────────────────────────────
async function runSimulator(chatHistory, userReply) {
  const history = Array.isArray(chatHistory) ? chatHistory : [];
  const historyBlock =
    history.length > 0
      ? `\nCHAT HISTORY (oldest → newest):\n${history
          .map((m) => `${m.role === 'assistant' ? 'HER' : 'HIM'}: ${m.content}`)
          .join('\n')}\n`
      : '';

  const simulatorPrompt = `You are running a hyper-realistic dating simulator.
There are two roles you must play simultaneously:

1. THE GIRL: An attractive, 24-year-old Israeli girl. She gets a lot of attention. Casual Hebrew slang (יאללה, ברור, סבבה, מה נסגר). If the user gives dry 1-word answers ("כן", "בסדר", "חחח", "אוקיי", "נכון") — she does NOT say "מעניין", "ספר עוד", "איך היה היום", or ask him to open up. She loses interest, goes cold, teases sarcastically, or gives equally dry energy. She is NOT an AI assistant. No robotic filler.

2. THE ELITE COACH: World's top dating psychologist for Israeli men. Mechanically dissects the user's text — frame, investment, who leads, ערס vs needy.

${historyBlock}
User Last Reply: "${userReply}"

Analyze the user's reply in full chat context.
ALPHA = ערס grounded, leads, creates tension or moves toward meetup, high value — short is OK only if it still holds frame ("יודע. סוף.", "ברור. חמישי?").
BETA = needy, apologetic, over-investing, reactive, OR dry 1-word that dumps conversational burden on her ("בסדר", "כן", "חחח" alone).

Return ONLY valid JSON with NO markdown:
{
  "isBeta": true or false,
  "analysis": "If isBeta true: deep 3-sentence psychological breakdown in Hebrew from Elite Coach — name the EXACT failed mechanic (e.g. forcing her to carry the chat). If false: exactly 'תגובה חזקה.'",
  "nextGirlReply": "If isBeta false: her next natural human Hebrew text — slang OK, emojis rare. If he was previously dry, she stays cold/teasing. If isBeta true: empty string \"\""
}`;

  const messages = [
    {
      role: 'system',
      content:
        'You simulate realistic Israeli dating dynamics. Never use AI filler ("מעניין", "ספר עוד", "איך היה היום שלך"). Return pure JSON only.'
    },
    { role: 'user', content: simulatorPrompt }
  ];

  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 550
    },
    { headers: groqHeaders() }
  );

  return parseGroqJson(response.data.choices[0].message.content);
}

app.post('/api/simulate', async (req, res) => {
  const { chatHistory, userReply } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'המפתח לא מוגדר בשרת' });
  }
  if (!userReply || !String(userReply).trim()) {
    return res.status(400).json({ error: 'חסרה תגובה' });
  }

  try {
    const parsed = await runSimulator(chatHistory, String(userReply).trim());
    const isBeta = Boolean(parsed.isBeta);
    res.json({
      success: true,
      isBeta,
      analysis: parsed.analysis || (isBeta ? 'נפילת ערך — לא מוביל.' : 'תגובה חזקה.'),
      reframeHint: isBeta ? (parsed.reframeHint || '') : '',
      nextGirlReply: isBeta ? '' : (parsed.nextGirlReply || '').trim()
    });
  } catch (err) {
    console.error('Simulate Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'שגיאה במנוע הסימולציה' });
  }
});

// תאימות ל-frontend הישן
app.post('/api/alpha-sim', async (req, res) => {
  const { message, context, chatHistory } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'המפתח לא מוגדר בשרת' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'חסרה הודעה' });
  }

  const history = Array.isArray(chatHistory)
    ? chatHistory
    : context
      ? [{ role: 'user', content: String(context) }]
      : [];

  try {
    const parsed = await runSimulator(history, String(message).trim());
    res.json({
      success: true,
      isBeta: Boolean(parsed.isBeta),
      errorHe: parsed.analysis || 'תגובה נויה מדי.',
      reframeHint: parsed.reframeHint || 'קצר. ערס. יודע — בלי להתנצל.',
      nextGirlReply: parsed.nextGirlReply || ''
    });
  } catch (err) {
    console.error('Alpha-sim Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'שגיאה במנוע הסימולציה' });
  }
});

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
