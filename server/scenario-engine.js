/**
 * 4 Answers — POST /api/generate-script & /api/scenario (Google Gemini)
 *
 * System persona: elite social-dynamics / behaviorism expert (see promptManager SCENARIO_PROMPT).
 * Weak input → Meta-Commentary in Alpha TIP + full archetype set (never reject).
 * Alpha format: MOVE — TIP (high-value line + short coaching).
 *
 * Simulator session scoring (POST /api/feedback): coach-engine.js + lib/hard-grading.js
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  CHANNEL_CTX,
  ALPHA_MAX_WORDS,
  ALPHA_TIP_SEP,
  alphaMissingHighValueTip,
  enforceAlphaRules,
  responsesLookRobotic,
  sanitizeResponses,
  trimAlphaWords,
  stripTrailingPeriods
} = require('./prompts/archetypes');
const {
  buildScenarioSystemPrompt,
  normalizeScenarioStage,
  resolveScenarioStage
} = require('./promptManager');

/**
 * Alpha: MOVE (3-12) + TIP (4-14) separated by " — ", max ~26 words total.
 * Witty 3-10, friendly/beta 6-15.
 */
const ARCHETYPE_WORD_LIMITS = {
  alpha: { max: ALPHA_MAX_WORDS, emojis: false },
  witty: { max: 10, emojis: true },
  beta: { max: 15, emojis: true },
  friendly: { max: 15, emojis: true }
};

const FRIENDLY_MIN_TEXT_WORDS = 3;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

/** 1.5-flash retired (404). Override via GEMINI_MODEL in .env */
const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];
/** gemini-2.5-flash needs headroom (400 truncates JSON mid-stream) */
const SCENARIO_MAX_OUTPUT_TOKENS = 1024;
const SCENARIO_RETRY_OUTPUT_TOKENS = 2048;

/** Forces strict { alpha, beta, witty, friendly } JSON from Gemini */
const SCENARIO_JSON_SCHEMA = {
  type: 'object',
  properties: {
    alpha: { type: 'string' },
    beta: { type: 'string' },
    witty: { type: 'string' },
    friendly: { type: 'string' }
  },
  required: ['alpha', 'beta', 'witty', 'friendly']
};

/** Last-resort: pull archetype strings when JSON.parse fails */
function extractJsonFieldsLoose(raw) {
  const text = String(raw);
  const keys = ['alpha', 'beta', 'witty', 'friendly'];
  const out = {};
  for (const key of keys) {
    const patterns = [
      new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i'),
      new RegExp(`'${key}'\\s*:\\s*'([^']*)'`, 'i'),
      new RegExp(`${key}\\s*:\\s*"([^"]*)"`, 'i')
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        out[key] = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        break;
      }
    }
  }
  return out;
}

/** Fix known AI Hebrew bugs on raw JSON string before parse */
function cleanGroqHebrewBeforeParse(aiResponse) {
  let cleanResponse = String(aiResponse ?? '');
  cleanResponse = cleanResponse.replace(/להזיע\s+לך/gi, 'לעזור לך');
  cleanResponse = cleanResponse.replace(/להזיע\s+לכי/gi, 'לעזור לך');
  cleanResponse = cleanResponse.replace(/להזיע/gi, 'לעזור');
  return cleanResponse;
}

/**
 * Alpha grammar: dative לך (not לכי); tips to the user use masculine imperatives.
 */
function fixAlphaHebrewGrammar(text) {
  let t = String(text ?? '').trim();
  if (!t) return t;

  t = t
    .replace(/מתאים\s+לכי/gi, 'מתאים לך')
    .replace(/שווה\s+לכי/gi, 'שווה לך')
    .replace(/(^|[\s,(])(ב|ל|אל|עם|אצל)\s*לכי([\s,.!?—]|$)/g, '$1$2 לך$3')
    .replace(/\s\|\s/g, ALPHA_TIP_SEP);

  const parts = t.split(ALPHA_TIP_SEP);
  if (parts.length >= 2) {
    parts[0] = parts[0].trim();
    parts[1] = parts[1]
      .replace(/תגידי/g, 'תגיד')
      .replace(/תשלחי/g, 'תשלח')
      .replace(/תישארי/g, 'תישאר')
      .replace(/תשמרי/g, 'תשמור')
      .replace(/תנסי/g, 'תנסה')
      .trim();
    t = `${parts[0]}${ALPHA_TIP_SEP}${parts.slice(1).join(ALPHA_TIP_SEP)}`;
  }

  return t.replace(/\s{2,}/g, ' ').trim();
}

const DEFAULT_ALPHA_TIPS = {
  breakup: 'אל תמשיך לדבר, תישאר אדיש',
  validation: 'משפט זה יוצר מתח. תגיד בביטחון',
  frame_test: 'משפט זה יוצר מתח. תגיד בביטחון',
  domestic: 'שומר על מסגרת. תגיד בלי להתנצל',
  demand: 'גבול ברור. תשלח ותשתוק',
  dry_laugh: 'עקיצה קלה. תשלח בלי להסביר',
  general: 'תגיד בקצב רגוע, בלי להסביר'
};

function defaultAlphaTipForMove(move) {
  const m = String(move || '').toLowerCase();
  if (/סגור|ביי|קיבלתי|בהצלחה/.test(m)) return DEFAULT_ALPHA_TIPS.breakup;
  if (/לא חושב|יודע|תבחני/.test(m)) return DEFAULT_ALPHA_TIPS.frame_test;
  if (/הפוך|תכיני|תבשלי/.test(m)) return DEFAULT_ALPHA_TIPS.domestic;
  if (/לא ככה|עובד פה/.test(m)) return DEFAULT_ALPHA_TIPS.demand;
  return DEFAULT_ALPHA_TIPS.general;
}

/** Ensures Alpha is MOVE — TIP unless ultra-short breakup cut */
function ensureAlphaHighValueFormat(alpha) {
  let a = stripTrailingPeriods(fixAlphaHebrewGrammar(alpha));
  if (!a) return a;

  if (!alphaMissingHighValueTip(a)) {
    return trimAlphaWords(a, ALPHA_MAX_WORDS);
  }

  const move = a.trim();
  const tip = defaultAlphaTipForMove(move);
  a = `${move}${ALPHA_TIP_SEP}${tip}`;
  return trimAlphaWords(a, ALPHA_MAX_WORDS);
}

function polishAlphaResponse(alpha) {
  return ensureAlphaHighValueFormat(stripEmojis(fixAlphaHebrewGrammar(alpha)));
}

/** Strip markdown fences and extract JSON object before parse */
function safeParseScenarioJson(raw) {
  if (raw == null || raw === '') {
    throw new Error('Empty AI response');
  }

  let text = cleanGroqHebrewBeforeParse(String(raw).trim());

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  }

  text = text
    .replace(/^```json\s*/gi, '')
    .replace(/^```\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    const loose = extractJsonFieldsLoose(text);
    if (Object.values(loose).some(Boolean)) {
      console.warn('[scenario] incomplete JSON; used loose field extract');
      return loose;
    }
    throw new Error(
      start >= 0 ? 'Incomplete JSON in AI response (output truncated)' : 'No JSON object in AI response'
    );
  }
  text = text.slice(start, end + 1);

  try {
    return JSON.parse(text);
  } catch (firstErr) {
    const fixed = text
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\u201C\u201D]/g, '"');
    try {
      return JSON.parse(fixed);
    } catch {
      const loose = extractJsonFieldsLoose(text);
      if (Object.values(loose).some(Boolean)) {
        console.warn('[scenario] JSON parse failed; used loose field extract');
        return loose;
      }
      throw new Error(`JSON parse failed: ${firstErr.message}`);
    }
  }
}

function pickReplyValue(obj, key) {
  if (!obj || typeof obj !== 'object') return '';
  let v = obj[key];
  if (v && typeof v === 'object') {
    v = v.text ?? v.reply ?? v.message ?? v.content ?? '';
  }
  let t = String(v ?? '').trim();
  if (
    /^\[.*\]$/.test(t) &&
    /e\.g\.|Write a NEW|1-5 words|Push-pull|Needy|Cynical|Warm|masculine|Dominant|patronizing|Simp|Absurd|CRITICAL|her specific message|EXACTLY formats/i.test(
      t
    )
  ) {
    return '';
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

const ROBOTIC_HEBREW_REPLACEMENTS = [
  [/תעשי\s+שינה/gi, 'לכי לישון'],
  [/תשקי\b/gi, 'תשתי'],
  [/תלכי\s+לישון/gi, 'לכי לישון'],
  [/חה\s+חה/gi, 'חחח'],
  [/אני\s+חושבת\b/gi, 'אני חושב'],
  [/אני\s+יודעת\b/gi, 'אני יודע'],
  [/אני\s+עייפה\b/gi, 'אני עייף'],
  [/אני\s+גמורה\b/gi, 'אני גמור'],
  [/אני\s+טוב\b/gi, 'הכל אש'],
  [/אני\s+בסדר\b/gi, 'וואלה'],
  [/זה בסדר להרגיש ככה/gi, ''],
  [/אני מבין אותך/gi, ''],
  [/זה נורמלי להרגיש/gi, ''],
  [/\bאתה\b/g, 'את'],
  [/להזיע\s+לך/gi, 'לעזור לכי'],
  [/להזיע\s+לכי/gi, 'לעזור לכי'],
  [/להזיע/gi, 'לעזור']
];

function applyHebrewSafetyNet(text) {
  let t = String(text ?? '');
  for (const [re, rep] of ROBOTIC_HEBREW_REPLACEMENTS) {
    t = t.replace(re, rep);
  }
  return t.replace(/\s{2,}/g, ' ').trim();
}

function trimScenarioWords(text, maxWords) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

function stripEmojis(text) {
  return String(text || '')
    .replace(EMOJI_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureBetaEmojis(text) {
  if (/[🥺😥🙏]/.test(text)) return text;
  return `${text} 🥺`.trim();
}

/**
 * Friendly MUST be a full engaging sentence + emoji.
 * Emoji-only outputs are absolutely forbidden — if the model lazily replies
 * with just a smile, we substitute a complete fallback line.
 */
function ensureFriendlyEmojis(text) {
  const raw = String(text || '').trim();
  const noEmoji = stripEmojis(raw).trim();
  const textWords = noEmoji.split(/\s+/).filter(Boolean);
  if (textWords.length < FRIENDLY_MIN_TEXT_WORDS) {
    return 'זורם לגמרי 😊 מה התוכניות שלך להמשך';
  }
  if (/[😊🫶😴💤❤️🙏]/.test(raw)) return raw;
  return `${raw} 😊`.trim();
}

function polishScenarioResponses(responses) {
  const out = {};
  for (const key of ['alpha', 'beta', 'witty', 'friendly']) {
    const limits = ARCHETYPE_WORD_LIMITS[key];
    let t = applyHebrewSafetyNet(String(responses[key] || ''));
    t = t.replace(/\bילדה\b/gi, '').replace(/\bgirl\b/gi, '');
    if (!limits.emojis) {
      t = stripEmojis(t);
    }
    t = t.replace(/\s{2,}/g, ' ').replace(/\.+$/g, '').trim();
    if (key === 'alpha') {
      t = polishAlphaResponse(t);
      t = trimAlphaWords(t, limits.max);
    } else {
      t = trimScenarioWords(t, limits.max);
    }
    if (key === 'beta') t = ensureBetaEmojis(t);
    if (key === 'friendly') t = ensureFriendlyEmojis(t);
    out[key] = t;
  }
  return out;
}

function responsesFromParsed(parsed) {
  const src =
    parsed.responses && typeof parsed.responses === 'object' ? parsed.responses : parsed;

  return {
    alpha: pickReplyValue(src, 'alpha'),
    beta: pickReplyValue(src, 'beta'),
    witty: pickReplyValue(src, 'witty'),
    friendly: pickReplyValue(src, 'friendly')
  };
}

function stageForAlphaRules(scenarioStage) {
  const s = normalizeScenarioStage(scenarioStage);
  if (s === 'deep') return 'deep';
  if (s === 'middle') return 'middle';
  return 'beginning';
}

/** True when user input is too thin for a rich scenario (triggers Meta-Commentary protocol). */
function isWeakSituationInput(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (t.length < 10) return true;
  if (/^(היי|הי|hey|hi|hello|שלום|test|טסט|מה נשמה|מה קורה|מה נשמע)\.?$/i.test(t)) {
    return true;
  }
  return false;
}

/** User turn: situation text (+ channel context for the model) */
function buildScenarioUserPrompt(situation, channel) {
  const situationText = String(situation || '').trim();
  const ch = CHANNEL_CTX[channel] || CHANNEL_CTX.app;
  const weak = isWeakSituationInput(situationText);
  const metaNote = weak
    ? `\nINPUT QUALITY: LOW — Alpha TIP must note what is weak + how to upgrade frame; still deliver all 4 archetypes.\n`
    : '';
  return `SITUATION (her message — respond only to this):
"${situationText}"

Channel: ${ch}
${metaNote}
Alpha MUST be two parts separated by " — ": MOVE (line to send her) — TIP (short coaching to him, masculine, explains why it works).
Output JSON with exactly these keys: alpha, beta, witty, friendly.`;
}

function isModelNotFoundError(err) {
  const status = err.status ?? err.statusCode;
  const msg = String(err.message || '');
  return status === 404 || /404|not found|is not found/i.test(msg);
}

function isRateLimitError(err) {
  const status = err.status ?? err.statusCode;
  const msg = String(err.message || '').toLowerCase();
  return (
    status === 429 ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('resource exhausted')
  );
}

function scenarioModelCandidates() {
  const primary = GEMINI_MODEL || 'gemini-2.5-flash';
  return [...new Set([primary, ...GEMINI_MODEL_FALLBACKS])];
}

function getGeminiClient() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY missing');
  }
  return new GoogleGenerativeAI(key);
}

/**
 * Gemini — systemInstruction from promptManager + strict JSON mode
 */
function responseLooksTruncated(text, finishReason) {
  const t = String(text || '').trim();
  if (finishReason === 'MAX_TOKENS') return true;
  if (!t.startsWith('{')) return false;
  const end = t.lastIndexOf('}');
  return end <= 0 || !/"friendly"\s*:/i.test(t);
}

async function geminiScenarioComplete(
  systemInstruction,
  userPrompt,
  temperature = 0.32,
  maxOutputTokens = SCENARIO_MAX_OUTPUT_TOKENS
) {
  const genAI = getGeminiClient();
  const models = scenarioModelCandidates();
  let lastErr;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: SCENARIO_JSON_SCHEMA
        }
      });

      const result = await model.generateContent(userPrompt);
      const finishReason = result.response?.candidates?.[0]?.finishReason;
      const responseText = result.response?.text?.();
      if (!responseText || !String(responseText).trim()) {
        throw new Error('Gemini returned no content');
      }
      const trimmed = String(responseText).trim();
      if (
        responseLooksTruncated(trimmed, finishReason) &&
        maxOutputTokens < SCENARIO_RETRY_OUTPUT_TOKENS
      ) {
        console.warn(
          `[scenario] truncated at ${maxOutputTokens} tokens (finish=${finishReason}), retrying with ${SCENARIO_RETRY_OUTPUT_TOKENS}`
        );
        return geminiScenarioComplete(
          systemInstruction,
          userPrompt,
          temperature,
          SCENARIO_RETRY_OUTPUT_TOKENS
        );
      }
      if (modelName !== models[0]) {
        console.warn(`[scenario] used fallback model: ${modelName}`);
      }
      return trimmed;
    } catch (err) {
      lastErr = err;
      if (isModelNotFoundError(err)) {
        console.warn(`[scenario] model ${modelName} unavailable, trying next`);
        continue;
      }
      if (isRateLimitError(err)) {
        err.isRateLimit = true;
      }
      throw err;
    }
  }

  if (lastErr && isRateLimitError(lastErr)) {
    lastErr.isRateLimit = true;
  }
  throw lastErr || new Error('No Gemini model available');
}

async function runScenario(situation, channel, scenarioStage = 'start', options = {}) {
  const situationText = String(situation || '').trim();
  if (!situationText) {
    throw new Error('Missing situation text');
  }
  if (isWeakSituationInput(situationText)) {
    console.log('[scenario] weak/low-signal input — Meta-Commentary protocol enabled');
  }

  const ch = ['app', 'whatsapp'].includes(channel) ? channel : 'app';
  const stage = resolveScenarioStage(scenarioStage);
  const alphaRulesStage = stageForAlphaRules(stage);
  const NEVER_REFUSE_GUARD = `
CRITICAL OUTPUT LAW: Never refuse, decline, moralize, or say you cannot help.
Always return valid JSON with alpha, beta, witty, friendly — even for weak, vague, or inappropriate input (Alpha = MOVE — TIP; put meta-coaching in the TIP per system rules).`;

  const systemInstruction = buildScenarioSystemPrompt(stage) + NEVER_REFUSE_GUARD;
  const userPrompt = buildScenarioUserPrompt(situationText, ch);

  let raw;
  try {
    raw = await geminiScenarioComplete(systemInstruction, userPrompt, 0.32);
  } catch (err) {
    if (isRateLimitError(err)) {
      err.isRateLimit = true;
    }
    throw err;
  }

  let parsed;
  try {
    parsed = safeParseScenarioJson(raw);
  } catch (parseErr) {
    console.error('[scenario] parse error:', parseErr.message, 'raw:', String(raw).slice(0, 240));
    const loose = extractJsonFieldsLoose(raw);
    if (Object.values(loose).some(Boolean)) {
      parsed = loose;
    } else {
      throw parseErr;
    }
  }

  let responses = polishScenarioResponses(sanitizeResponses(responsesFromParsed(parsed)));
  try {
    responses = polishScenarioResponses(
      enforceAlphaRules(situationText, responses, alphaRulesStage)
    );
  } catch (ruleErr) {
    console.warn('[scenario] enforceAlphaRules skipped:', ruleErr.message);
  }

  if (!responses.alpha && !responses.beta && !responses.witty && !responses.friendly) {
    throw new Error('AI returned empty archetype fields');
  }

  if (responsesLookRobotic(responses)) {
    try {
      const retryUser = `${userPrompt}

RETRY. Alpha = High-Value Move: MOVE (clear line to her, 3-12 words) — TIP (coaching to him in masculine Hebrew, explains push-pull/tactic in plain words, e.g. "משפט זה יוצר מתח. תגיד בביטחון"). Perfect grammar: לך not לכי for "to you". Up to 26 words total. NO needy validation, NO AI-formal words, NO trailing period. Friendly = full sentence + emoji. Output ONLY raw JSON — no markdown.`;
      const retryRaw = await geminiScenarioComplete(systemInstruction, retryUser, 0.42);
      parsed = safeParseScenarioJson(retryRaw);
      responses = polishScenarioResponses(sanitizeResponses(responsesFromParsed(parsed)));
      try {
        responses = polishScenarioResponses(
          enforceAlphaRules(situationText, responses, alphaRulesStage)
        );
      } catch (ruleErr) {
        console.warn('[scenario] enforceAlphaRules retry skipped:', ruleErr.message);
      }
    } catch (retryErr) {
      if (!isRateLimitError(retryErr)) {
        console.warn('[scenario] retry skipped:', retryErr.message);
      }
    }
  }

  return {
    alpha: responses.alpha || `סבבה${ALPHA_TIP_SEP}תגיד בקצב רגוע, בלי להסביר`,
    beta: responses.beta || 'אוקיי מבין',
    witty: responses.witty || 'חחח נראה',
    friendly: responses.friendly || 'בכיף'
  };
}

function formatScenarioError(err) {
  const msg = err?.message || '';
  if (msg.includes('API key') || msg.includes('API_KEY')) {
    return 'מפתח Gemini לא תקין או חסר';
  }
  if (isModelNotFoundError(err)) {
    return 'מודל Gemini לא זמין — עדכן GEMINI_MODEL ב-.env (למשל gemini-2.5-flash)';
  }
  if (err.isRateLimit || isRateLimitError(err)) {
    return msg || 'מכסת Gemini — נסה שוב בעוד כמה דקות';
  }
  return msg || 'Unknown error';
}

module.exports = {
  runScenario,
  isWeakSituationInput,
  buildScenarioUserPrompt,
  safeParseScenarioJson,
  safeParseGroqJson: safeParseScenarioJson,
  cleanGroqHebrewBeforeParse,
  fixAlphaHebrewGrammar,
  polishAlphaResponse,
  ensureAlphaHighValueFormat,
  formatScenarioError,
  formatGroqError: formatScenarioError,
  geminiScenarioComplete,
  buildScenarioSystemPrompt,
  GEMINI_MODEL,
  SCENARIO_JSON_SCHEMA
};
