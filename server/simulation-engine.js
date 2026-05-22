/**
 * Maya chat sim — POST /api/chat (Google Gemini, plain text)
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildChatSystemPrompt } = require('./promptManager');
const { formatScenarioError, GEMINI_MODEL } = require('./scenario-engine');

const CHAT_MODEL = (process.env.GEMINI_MODEL || GEMINI_MODEL || 'gemini-2.5-flash').trim();
const CHAT_FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
const CHAT_MAX_OUTPUT_TOKENS = 512;

const META_JSON_KEYS = new Set([
  'analysis',
  'feedback',
  'score',
  'strengths',
  'improvements',
  'isBeta',
  'reframeHint',
  'errorHe'
]);
const META_FIELD_RE = /^(analysis|feedback|score|strengths|improvements|isBeta)\s*:/i;
const COACH_LINE_RE =
  /^(תגובה חזקה|תגובה נויה|נפילת ערך|מומלץ|כדאי ל|נסה ל|הייתי ממליצ|בינוני|מצוין|מאמן|מנתח)/i;

function getGeminiClient() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY missing');
  return new GoogleGenerativeAI(key);
}

function chatModelCandidates() {
  const primary = CHAT_MODEL || 'gemini-2.5-flash';
  return [...new Set([primary, ...CHAT_FALLBACKS])];
}

function isModelNotFoundError(err) {
  const msg = String(err?.message || '');
  return (err?.status ?? err?.statusCode) === 404 || /404|not found/i.test(msg);
}

function isRateLimitError(err) {
  const status = err?.status ?? err?.statusCode;
  const msg = String(err?.message || '').toLowerCase();
  return status === 429 || msg.includes('quota') || msg.includes('too many requests');
}

/** Build Gemini chat history (user = male trainee, model = her) */
function buildGeminiChatHistory(chatHistory, currentUserMessage) {
  const situationText = String(currentUserMessage || '').trim();
  let hist = Array.isArray(chatHistory) ? [...chatHistory] : [];
  const last = hist[hist.length - 1];
  if (last?.role === 'user' && String(last.content).trim() === situationText) {
    hist = hist.slice(0, -1);
  }

  const out = [];
  for (const m of hist) {
    const content = String(m.content || m.text || '').trim();
    if (!content) continue;
    const isHer = m.role === 'assistant' || m.role === 'her';
    const role = isHer ? 'model' : 'user';
    const entry = { role, parts: [{ text: content }] };
    const prev = out[out.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += '\n' + content;
    } else {
      out.push(entry);
    }
  }

  // Gemini chat history must start with user
  if (out.length && out[0].role === 'model') {
    out.unshift({ role: 'user', parts: [{ text: 'היי' }] });
  }
  return out;
}

function fixImperativesToMaleUser(text) {
  return String(text ?? '')
    .replace(/(^|[\s"',])תעשי([\s"'.!?,]|$)/g, '$1תעשה$2')
    .replace(/(^|[\s"',])תגידי([\s"'.!?,]|$)/g, '$1תגיד$2')
    .replace(/(^|[\s"',])תשבי([\s"'.!?,]|$)/g, '$1תשב$2')
    .replace(/(^|[\s"',])תסבירי([\s"'.!?,]|$)/g, '$1תסביר$2')
    .replace(/(^|[\s"',])תשלחי([\s"'.!?,]|$)/g, '$1תשלח$2')
    .replace(/(^|[\s"',])תבואי([\s"'.!?,]|$)/g, '$1תבוא$2')
    .replace(/(^|[\s"',])תכתבי([\s"'.!?,]|$)/g, '$1תכתוב$2');
}

function fixFormalHebrew(text) {
  return String(text ?? '')
    .replace(/\bהיכן\b/g, 'איפה')
    .replace(/\bמדוע\b/g, 'למה')
    .replace(/\bאעקבי\b/g, 'סגור')
    .replace(/\bואילו\b/g, 'זורם')
    .replace(/\bאוכל\b/g, 'בא לי')
    .replace(/\bאשמח\b/g, 'יאללה');
}

function tryParseJsonReply(raw) {
  try {
    const clean = String(raw).replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/** Plain text only — strip JSON / coach blobs if the model hallucinates them */
function toPlainWomanText(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';

  text = text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();

  if (text.startsWith('{')) {
    const o = tryParseJsonReply(text);
    if (o) {
      text = String(
        o.woman_response || o.response || o.reply || o.message || o.content || ''
      ).trim();
      if (!text) {
        for (const k of META_JSON_KEYS) {
          if (typeof o[k] === 'string' && o[k].trim()) {
            text = '';
            break;
          }
        }
      }
    }
  }

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !META_FIELD_RE.test(l) && !COACH_LINE_RE.test(l));
  text = (lines.length ? lines.join(' ') : text).trim();

  if (text.length > 400) {
    text = text.split(/\s+/).slice(0, 40).join(' ');
  }
  text = fixFormalHebrew(fixImperativesToMaleUser(text));
  return text.replace(/\.+$/g, '').trim();
}

async function geminiChatReply(chatHistory, userMessage) {
  const genAI = getGeminiClient();
  const systemInstruction = buildChatSystemPrompt();
  const history = buildGeminiChatHistory(chatHistory, userMessage);
  const msg = String(userMessage || '').trim();
  let lastErr;

  for (const modelName of chatModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS
        }
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(msg);
      const raw = result.response?.text?.();
      if (!raw?.trim()) throw new Error('Gemini returned no chat content');
      return raw.trim();
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) {
        console.warn(`[chat] model ${modelName} unavailable, trying next`);
        continue;
      }
      if (isRateLimitError(err)) err.isRateLimit = true;
      throw err;
    }
  }

  throw lastErr || new Error('No Gemini model available for chat');
}

/** Chat turn — plain text, no JSON mode */
async function runSimulationEngine(chatHistory, situation) {
  const userMessage = String(situation || '').trim();
  const raw = await geminiChatReply(chatHistory, userMessage);
  const text = toPlainWomanText(raw);
  return text || 'חחח אוקיי';
}

module.exports = {
  runSimulationEngine,
  buildChatSystemPrompt,
  formatChatError: formatScenarioError,
  CHAT_MODEL
};
