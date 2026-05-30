/**
 * Maya chat sim — POST /api/chat (Google Gemini, plain text)
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildChatSystemPrompt } = require('./promptManager');
const {
  normalizeDifficulty,
  getChatTemperature,
  getOpenerForDifficulty
} = require('./sim-difficulty');
const { formatScenarioError, GEMINI_MODEL } = require('./scenario-engine');
const {
  stripThinkingLeakage,
  extractVisibleGeminiText,
  geminiThinkingConfig
} = require('./lib/strip-thinking');

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

/** Plain text only — strip JSON / coach blobs / THINK leaks if the model hallucinates them */
function toPlainWomanText(raw) {
  let text = stripThinkingLeakage(String(raw || '').trim());
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

const SAPHIR_HARD_SHORT_FALLBACK =
  'וואו שאלה. אני אוהבת אנשים שחושבים שהם מעניינים — נראה אם אתה באמת. מה אתה עושה בחיים חוץ מלנסות לרשום אותי?';

/** Hard (ספיר): enforce Hook Rule — at least ~2 sentences, never icy one-liners */
function countSaphirSentences(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const punct = t.split(/[.!?…]+/).filter((s) => s.trim().length > 4);
  if (punct.length >= 2) return punct.length;
  const clauses = t.split(/[,—–]+/).filter((s) => s.trim().length > 6);
  if (clauses.length >= 2) return clauses.length;
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words >= 16) return 2;
  if (words >= 9) return 1;
  return words >= 4 ? 1 : 0;
}

function enforceSaphirHardReply(text) {
  let t = String(text || '').trim();
  if (!t) return SAPHIR_HARD_SHORT_FALLBACK;
  if (countSaphirSentences(t) >= 2) return t;
  if (t.split(/\s+/).filter(Boolean).length <= 4) {
    return SAPHIR_HARD_SHORT_FALLBACK;
  }
  return `${t} אני מקווה שיש פה עוד שכבה — תפתח מסלול, אל תשאיר אותי משועממת`;
}

/** ספיר hard — detect date push, yield, objection loops */
const SAPHIR_DATE_PUSH_RE =
  /בוא\s+ניפגש|ניפגש|דייט|תגיע|תבוא|תאסוף|אוסף אותך|מחר|הערב|בשעה|תשע|ב-?9|תהיי\s+מוכנ|מוכנה\s+(ל)?תשע|מוכנה\s+ב|נדגש|יציאה|בוא\s+נצא/i;
const SAPHIR_ALPHA_FRAME_RE =
  /סבבה|יאללה|אני\s+קובע|אני\s+מחליט|תסמכי|סומך|תהיי|תהייי|אל\s+תאחר|בלי\s+לשאול|פשוט\s+תגיע|תבוא\s+ב/i;
const SAPHIR_RESISTANCE_RE =
  /למה\s|איפה\s|מה\s+אתה\s+רוצה|אני\s+עסוק|אין\s+לי\s+זמן|לא\s+יודעת|למה\s+אני|מה\s+זה\s+אמור|לא\s+בטוחה\s+לאן/i;
const SAPHIR_YIELD_RE =
  /בסדר|אוקיי|יאללה\s+סבבה|סבבה.*(תשע|9|מוכנ)|אהיה\s+מוכנ|מוכנה\s+לתשע|נדגש|בשעה\s+תשע|אל\s+תאחר|לא\s+ניצחת|עדיין\s+צריך\s+לרשום/i;

function normalizeSaphirHistory(chatHistory) {
  return (Array.isArray(chatHistory) ? chatHistory : [])
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'her' ? 'her' : 'user',
      content: String(m.content || m.text || '').trim()
    }))
    .filter((m) => m.content);
}

function analyzeSaphirThread(chatHistory, userMessage) {
  const hist = normalizeSaphirHistory(chatHistory);
  const uNow = String(userMessage || '').trim();
  const userMsgs = hist.filter((m) => m.role === 'user').map((m) => m.content);
  const herMsgs = hist.filter((m) => m.role === 'her').map((m) => m.content);

  let alphaBeatStreak = 0;
  for (const u of userMsgs.slice(-5)) {
    const datePush = SAPHIR_DATE_PUSH_RE.test(u);
    const alphaFrame =
      SAPHIR_ALPHA_FRAME_RE.test(u) ||
      (datePush && u.length >= 8) ||
      (u.length >= 18 && !/סליחה|מצטער|בבקשה|לא\s+בטוח/i.test(u));
    if (alphaFrame) alphaBeatStreak += 1;
    else if (u.length > 3) alphaBeatStreak = 0;
  }

  const currentDatePush =
    SAPHIR_DATE_PUSH_RE.test(uNow) ||
    (SAPHIR_ALPHA_FRAME_RE.test(uNow) && /תשע|9|מוכנ|בשעה|ניפגש|דייט/i.test(uNow));

  const alreadyYielded = herMsgs.some(
    (m) => SAPHIR_YIELD_RE.test(m) && /תשע|9|מוכנ|ניפגש|נדגש|בשעה/i.test(m)
  );

  const lastHer = herMsgs.slice(-3);
  const resistanceLoop =
    lastHer.length >= 2 &&
    lastHer.filter((m) => SAPHIR_RESISTANCE_RE.test(m)).length >= 2;

  const datePushTotal =
    userMsgs.filter((u) => SAPHIR_DATE_PUSH_RE.test(u)).length + (currentDatePush ? 1 : 0);

  return {
    alphaBeatStreak,
    currentDatePush,
    alreadyYielded,
    resistanceLoop,
    datePushTotal
  };
}

function buildSaphirHardTurnDirective(chatHistory, userMessage) {
  const a = analyzeSaphirThread(chatHistory, userMessage);

  if (a.alreadyYielded) {
    return (
      '\n\n[MANDATORY TURN — POST-ACCEPTANCE] You already agreed to the date/time. ' +
      'Do NOT ask why/where/what again or stall with "busy". ' +
      'Confirm the plan, tease him about the upcoming meet, stay playfully challenging — no apology.'
    );
  }

  if (a.currentDatePush || a.datePushTotal >= 2) {
    if (a.alphaBeatStreak >= 1 || a.datePushTotal >= 2) {
      return (
        '\n\n[MANDATORY TURN — YIELD] He is pushing the date with frame (time/place). ' +
        'Accept now with teasing acceptance — NOT sorry. ' +
        'Example vibe: בסדר אתה מתעקש אני מוכנה לתשע, רק אל תחשוב שניצחת אותי, עדיין צריך לרשום אותי פנים אל פנים, אל תאחר'
      );
    }
  }

  if (a.resistanceLoop && a.alphaBeatStreak >= 2) {
    return (
      '\n\n[MANDATORY TURN — PIVOT] Stop looping the same objection (busy/why/where). ' +
      'After his persistent alpha messages, shift to INTRIGUED: warmer, interested, new topic — or yield if he led a date.'
    );
  }

  if (a.alphaBeatStreak >= 3) {
    return (
      '\n\n[MANDATORY TURN — INTERESTED] He sent 3+ alpha beats. Reduce resistance; show interest with teasing flirt. ' +
      'If he mentioned meeting/time, lean toward YIELD with challenging acceptance.'
    );
  }

  return '';
}

async function geminiChatReply(chatHistory, userMessage, difficulty = 'medium') {
  const genAI = getGeminiClient();
  const level = normalizeDifficulty(difficulty);
  const systemInstruction = buildChatSystemPrompt(level);
  const history = buildGeminiChatHistory(chatHistory, userMessage);
  const msg = String(userMessage || '').trim();
  const temperature = getChatTemperature(level);
  let lastErr;

  for (const modelName of chatModelCandidates()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          temperature,
          maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
          ...geminiThinkingConfig(modelName)
        }
      });

      const chat = model.startChat({ history });
      const turnText =
        level === 'hard' ? `${msg}${buildSaphirHardTurnDirective(history, msg)}` : msg;
      const result = await chat.sendMessage(turnText);
      const raw = extractVisibleGeminiText(result.response);
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
async function runSimulationEngine(chatHistory, situation, difficulty = 'medium') {
  const userMessage = String(situation || '').trim();
  const level = normalizeDifficulty(difficulty);
  const raw = await geminiChatReply(chatHistory, userMessage, level);
  let text = toPlainWomanText(raw);
  if (level === 'hard') {
    text = enforceSaphirHardReply(text);
  }
  return text || (level === 'hard' ? getOpenerForDifficulty('hard') : 'חחח אוקיי');
}

module.exports = {
  runSimulationEngine,
  buildChatSystemPrompt,
  analyzeSaphirThread,
  buildSaphirHardTurnDirective,
  formatChatError: formatScenarioError,
  CHAT_MODEL
};
