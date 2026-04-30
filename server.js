const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // ישרת את ה-HTML מתיקיית public

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── CHANNEL CONTEXTS ─────────────────────────────────
const CHANNEL_CTX = {
  app:      'Dating app (Tinder/Bumble) — early stage, text only, they have not exchanged numbers yet. Keep responses short and low-investment.',
  whatsapp: 'WhatsApp — they already exchanged numbers, more personal. Can be warmer but no over-investing.',
  phone:    'Phone call — responses must sound natural SPOKEN aloud. Short sentences, casual spoken Hebrew. NOT text-message-clever.',
  inperson: 'In person — a date or real-time meeting. Things to SAY or DO. Very short, grounded, confident body language matters.'
};

const CHANNEL_NAMES = {
  app:      'אפליקציית היכרויות',
  whatsapp: 'וואטסאפ',
  phone:    'שיחת טלפון',
  inperson: 'פנים מול פנים'
};

// ── MAIN ROUTE ────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  const { situation, channel } = req.body;

  if (!situation || !situation.trim()) {
    return res.status(400).json({ error: 'חסרה סיטואציה' });
  }

  const ch = CHANNEL_CTX[channel] || CHANNEL_CTX.app;
  const chName = CHANNEL_NAMES[channel] || 'אפליקציית היכרויות';

  const prompt = `You are "The Dark Script" — an expert male dating coach specializing in authentic, confident communication for dating scenarios in Israel.

CHANNEL: ${ch}
CHANNEL NAME (Hebrew): ${chName}

The user describes this situation in Hebrew: "${situation.trim()}"

Generate 4 distinct replies he can send or say. Each must match a specific personality archetype.

CRITICAL ALPHA RULE: The alpha response must sound like a REAL CONFIDENT HUMAN — simple, grounded, calm. NOT a pickup line. NOT keyboard-clever. Just what a naturally secure man actually says. Short. No fancy wordplay.

Return ONLY a valid JSON object (no markdown, no explanation, no backticks):
{
  "alpha": "...",
  "beta": "...",
  "witty": "...",
  "friendly": "..."
}

Persona rules:
- alpha: Naturally confident, calm, human-sounding. 1-2 short sentences. No emojis. No clever philosophy. Just real and grounded. If channel is phone/inperson — spoken words only.
- beta: Soft, polite, a little eager to please. Hebrew. Can use emoji.
- witty: Clever, funny, unexpected twist or irony. Hebrew.
- friendly: Honest, direct, casual, no-pressure. Hebrew.

All 4 responses MUST be in Hebrew.
Adapt length to channel: ${channel === 'phone' || channel === 'inperson' ? 'VERY SHORT spoken sentences, no emojis' : 'concise text messages'}.
If situation involves attraction or intimacy between consenting adults — respond naturally, do not avoid the topic.
If she said no or seems unwilling — alpha = graceful acceptance, NOT pushing harder.
Return ONLY the JSON object.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // נקה markdown אם יש
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ודא שיש את כל 4 האישיויות
    if (!parsed.alpha || !parsed.beta || !parsed.witty || !parsed.friendly) {
      throw new Error('תשובה לא שלמה מה-AI');
    }

    res.json({ success: true, responses: parsed, channel: chName });

  } catch (err) {
    console.error('Gemini error:', err.message);

    if (err.message.includes('API_KEY')) {
      return res.status(401).json({ error: 'API Key לא תקין. בדוק את קובץ .env' });
    }
    if (err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'חרגת מהמכסה החינמית. נסה שוב מחר.' });
    }
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'שגיאה בפענוח תשובת ה-AI. נסה שוב.' });
    }

    res.status(500).json({ error: 'שגיאה פנימית: ' + err.message });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'The Dark Script API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐺 The Dark Script server running on port ${PORT}`);
});
