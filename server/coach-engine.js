/**
 * Dating coach feedback — POST /api/feedback (Gemini JSON)
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { COACH_PROMPT } = require('./promptManager');

const COACH_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const COACH_FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
const COACH_MAX_TOKENS = 2048;
const COACH_RETRY_TOKENS = 4096;

const COACH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    analysis: { type: 'string' },
    improvements: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['score', 'analysis', 'improvements']
};

function getGeminiClient() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY missing');
  return new GoogleGenerativeAI(key);
}

function coachModelCandidates() {
  const primary = COACH_MODEL || 'gemini-2.5-flash';
  return [...new Set([primary, ...COACH_FALLBACKS])];
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

function formatCoachError(err) {
  const msg = err?.message || '';
  if (msg.includes('API key') || msg.includes('API_KEY')) {
    return 'מפתח Gemini לא תקין או חסר';
  }
  if (isRateLimitError(err)) {
    return 'מכסת Gemini — נסה שוב בעוד כמה דקות';
  }
  return msg || 'שגיאה בניתוח השיחה';
}

function normalizeHistory(chatHistory) {
  return (Array.isArray(chatHistory) ? chatHistory : [])
    .map((m) => {
      const role = m.role === 'assistant' || m.role === 'her' ? 'her' : 'user';
      const content = String(m.content || m.text || '').trim();
      return content ? { role, content } : null;
    })
    .filter(Boolean);
}

function buildCoachUserPrompt(chatHistory) {
  const lines = normalizeHistory(chatHistory).map((m) => {
    const who = m.role === 'her' ? 'HER' : 'USER';
    return `[${who}] ${m.content}`;
  });
  if (!lines.length) {
    return 'No messages yet. Return score 0 and brief Hebrew analysis.';
  }
  return `Analyze this WhatsApp thread (USER = Israeli male trainee, HER = simulated woman):\n\n${lines.join('\n')}`;
}

function coachJsonLooksTruncated(text, finishReason) {
  const t = String(text || '').trim();
  if (finishReason === 'MAX_TOKENS') return true;
  if (!t.startsWith('{')) return true;
  return t.lastIndexOf('}') <= 0 || !/"improvements"\s*:/i.test(t);
}

function safeParseCoachJson(raw) {
  let text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    const scoreM = text.match(/"score"\s*:\s*(\d+)/);
    const analysisM = text.match(/"analysis"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (scoreM) {
      return {
        score: Number(scoreM[1]),
        analysis: analysisM ? analysisM[1].replace(/\\n/g, '\n') : '',
        improvements: []
      };
    }
    throw new Error('No JSON object in coach response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeCoachResult(parsed) {
  let score = Number(parsed?.score);
  if (!Number.isFinite(score)) score = 50;
  if (score <= 10 && score >= 0) score = score * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const analysis = String(parsed?.analysis || parsed?.feedback || '').trim();
  let improvements = parsed?.improvements;
  if (!Array.isArray(improvements)) {
    improvements = improvements ? [String(improvements)] : [];
  }
  improvements = improvements
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!improvements.length) {
    improvements = ['קצר יותר — מוביל, בלי להתנצל', 'שאל פחות — תן כיוון'];
  }

  return { score, analysis: analysis || 'יש מקום לחיזוק המסגרת והאנרגיה בשיחה.', improvements };
}

async function geminiCoachComplete(userPrompt, maxOutputTokens = COACH_MAX_TOKENS) {
  const genAI = getGeminiClient();
  let lastErr;

  for (const modelName of coachModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: COACH_PROMPT,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: COACH_JSON_SCHEMA
        }
      });
      const result = await model.generateContent(userPrompt);
      const finishReason = result.response?.candidates?.[0]?.finishReason;
      const text = result.response?.text?.();
      if (!text?.trim()) throw new Error('Gemini returned no coach content');
      const trimmed = text.trim();
      if (coachJsonLooksTruncated(trimmed, finishReason) && maxOutputTokens < COACH_RETRY_TOKENS) {
        console.warn(`[coach] truncated at ${maxOutputTokens}, retrying`);
        return geminiCoachComplete(userPrompt, COACH_RETRY_TOKENS);
      }
      return trimmed;
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) continue;
      if (isRateLimitError(err)) {
        err.isRateLimit = true;
      }
      throw err;
    }
  }
  throw lastErr || new Error('No Gemini model available for coach');
}

async function runCoachFeedback(chatHistory) {
  const hist = normalizeHistory(chatHistory);
  const userTurns = hist.filter((m) => m.role === 'user').length;
  if (userTurns < 2) {
    throw new Error('שלח לפחות 2 הודעות לפני סיכום');
  }

  const raw = await geminiCoachComplete(buildCoachUserPrompt(hist));
  const parsed = safeParseCoachJson(raw);
  return normalizeCoachResult(parsed);
}

module.exports = {
  runCoachFeedback,
  formatCoachError,
  buildCoachUserPrompt,
  COACH_MODEL
};
