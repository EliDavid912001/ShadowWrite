const express = require('express');
const { buildAnalyzePrompt, buildAlphaSimPrompt } = require('../prompts/archetypes');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function groqChat(prompt, maxTokens = 500, temperature = 0.15) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.replace(/```json|```/g, '').trim();
}

function parseJsonSafe(raw) {
  return JSON.parse(raw);
}

function handleGroqError(err, res) {
  console.error('Groq error:', err.message);
  if (err.message.includes('API') && err.message.includes('key')) {
    return res.status(401).json({ error: 'API Key לא תקין. בדוק את קובץ .env' });
  }
  if (err.message.includes('quota') || err.message.includes('rate_limit')) {
    return res.status(429).json({ error: 'חרגת מהמכסה. נסה שוב בעוד דקה.' });
  }
  if (err instanceof SyntaxError) {
    return res.status(500).json({ error: 'שגיאה בפענוח תשובת ה-AI. נסה שוב.' });
  }
  return res.status(500).json({ error: 'שגיאה פנימית: ' + err.message });
}

router.post('/analyze', async (req, res) => {
  const { situation, channel } = req.body;

  if (!situation || !String(situation).trim()) {
    return res.status(400).json({ error: 'חסרה סיטואציה' });
  }

  const validChannels = ['app', 'whatsapp'];
  const ch = validChannels.includes(channel) ? channel : 'app';

  try {
    const prompt = buildAnalyzePrompt(situation, ch);
    const clean = await groqChat(prompt, 550);
    const parsed = parseJsonSafe(clean);

    if (!parsed.alpha || !parsed.beta || !parsed.witty || !parsed.friendly) {
      throw new Error('תשובה לא שלמה מה-AI');
    }

    res.json({ success: true, responses: parsed, channel: ch });
  } catch (err) {
    return handleGroqError(err, res);
  }
});

router.post('/alpha-sim', async (req, res) => {
  const { message, context } = req.body;

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'חסרה הודעה' });
  }
  if (message.length > 800) {
    return res.status(400).json({ error: 'הודעה ארוכה מדי' });
  }

  try {
    const prompt = buildAlphaSimPrompt(message, context);
    const clean = await groqChat(prompt, 320, 0.7);
    const parsed = parseJsonSafe(clean);

    res.json({
      success: true,
      isBeta: Boolean(parsed.isBeta),
      severity: parsed.severity || 'medium',
      errorHe: parsed.errorHe || 'תגובה נויה מדי. קצר, רגוע, בלי להסביר.',
      reframeHint: parsed.reframeHint || 'הגיב כאילו אין לך מה להוכיח.'
    });
  } catch (err) {
    return handleGroqError(err, res);
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'The Dark Script VIP API is running' });
});

module.exports = router;
