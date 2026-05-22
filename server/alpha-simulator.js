/**
 * Alpha Training simulator — separate from dating chat (simulation-engine).
 * Turn: coach + girl reply. Summary: score only on end button.
 */
const axios = require('axios');
const {
  buildSimulatorMessages,
  buildSimulatorSummaryMessages,
  normalizeSimulatorResult,
  normalizeSimulatorSummary
} = require('./prompts/simulator');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function groqHeaders() {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) throw new Error('GROQ_API_KEY missing');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

function parseGroqJson(raw) {
  const clean = String(raw).replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function safeParseGroqJson(raw) {
  try {
    return parseGroqJson(raw);
  } catch (err) {
    console.warn('Alpha sim JSON parse failed:', String(raw).slice(0, 240));
    return null;
  }
}

async function groqJson(messages, options = {}) {
  const response = await axios.post(
    GROQ_URL,
    {
      model: GROQ_MODEL,
      messages,
      temperature: options.temperature ?? 0.88,
      max_tokens: options.max_tokens ?? 420,
      response_format: { type: 'json_object' }
    },
    { headers: groqHeaders() }
  );
  return response.data.choices[0].message.content;
}

/** One user message in alpha sim — never returns session score */
async function runAlphaSimTurn(chatHistory, userReply) {
  const reply = String(userReply || '').trim();
  const messages = buildSimulatorMessages(
    Array.isArray(chatHistory) ? chatHistory : [],
    reply
  );
  const raw = await groqJson(messages, { temperature: 0.88, max_tokens: 420 });
  let parsed = safeParseGroqJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    parsed = {
      isBeta: false,
      analysis: 'תגובה חזקה.',
      nextGirlReply: 'חחח אוקיי'
    };
  }
  return normalizeSimulatorResult(parsed, reply);
}

/** End button only — session score + strengths */
async function runAlphaSimSummary(chatHistory) {
  const history = Array.isArray(chatHistory) ? chatHistory : [];
  const messages = buildSimulatorSummaryMessages(history);
  const raw = await groqJson(messages, { temperature: 0.45, max_tokens: 520 });
  let parsed = safeParseGroqJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    parsed = {
      score: 50,
      gradeLabel: 'בינוני',
      strengths: ['המשכת שיחה'],
      improvements: ['קצר יותר, מוביל יותר'],
      summary: 'סיכום השיחה מוכן.'
    };
  }
  return normalizeSimulatorSummary(parsed);
}

module.exports = { runAlphaSimTurn, runAlphaSimSummary };
