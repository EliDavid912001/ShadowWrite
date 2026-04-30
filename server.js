const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/analyze', async (req, res) => {
  const { situation, channel } = req.body;
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'API Key חסר' });
  if (!situation) return res.status(400).json({ error: 'חסרה סיטואציה' });

  const prompt = `You are "The Dark Script" — an expert male dating coach helping MEN respond to WOMEN in Israeli dating culture.
The user is always a MAN texting or talking to a WOMAN.
All responses must be from a man's perspective, in Hebrew.

Situation: "${situation}"

Generate 4 responses:
- alpha: Confident, calm, short. Sounds like a real human. NOT clever or philosophical.
- beta: Soft, polite, a bit eager.
- witty: Funny, unexpected, clever.
- friendly: Honest, direct, casual.

Return ONLY valid JSON, no markdown:
{"alpha":"...","beta":"...","witty":"...","friendly":"..."}`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 400 })
  });

  const d = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: d?.error?.message || 'שגיאה' });
  const parsed = JSON.parse(d.choices[0].message.content.replace(/```json|```/g, '').trim());
  res.json({ success: true, responses: parsed });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on port ' + PORT));
