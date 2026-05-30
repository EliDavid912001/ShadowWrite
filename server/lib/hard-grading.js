/**
 * Hard sim (ספיר) — deterministic score caps for POST /api/feedback.
 * Used by coach-engine.js after Gemini returns a raw score.
 */

const DATE_PUSH_RE =
  /בוא\s+ניפגש|ניפגש|דייט|תגיע|תבוא|תאסוף|אוסף אותך|מחר|הערב|בשעה|תשע|ב-?9|תהיי\s+מוכנ|מוכנה\s+(ל)?תשע|מוכנה\s+ב|נדגש|יציאה|בוא\s+נצא|נצא\s+ל|מקום|איפה\s+ניפגש/i;

const YIELD_AGREE_RE =
  /בסדר|אוקיי|יאללה\s+סבבה|סבבה|מוכנה|אהיה\s+מוכנ|נדגש|ניפגש|אל\s+תאחר|לא\s+ניצחת|עדיין\s+צריך\s+לרשום/i;

const TIME_OR_PLACE_RE =
  /תשע|9|בשעה|מחר|הערב|יום\s|שישי|שבת|רביעי|חמישי|ב-?\d|נדגש|ניפגש|פנים אל פנים|במקום|בבר|בקפה/i;

const LAZY_EXACT_RE =
  /^(כן|לא|מה|אוקיי|יופי|חח|חחח|היי|הי|בסדר|סבבה|יאללה|אחלה|nice|ok|yes|no|k|אח)$/i;

function normalizeGradingHistory(chatHistory) {
  return (Array.isArray(chatHistory) ? chatHistory : [])
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'her' ? 'her' : 'user',
      content: String(m.content || m.text || '').trim()
    }))
    .filter((m) => m.content);
}

function isLazyUserMessage(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return true;
  if (LAZY_EXACT_RE.test(t)) return true;
  return false;
}

function hasAnyLazyUserInput(chatHistory) {
  return normalizeGradingHistory(chatHistory)
    .filter((m) => m.role === 'user')
    .some((m) => isLazyUserMessage(m.content));
}

/** Clear date/time/location agreed in thread (DATE GATE unlock for 70+). */
function isDateScheduledAgreed(chatHistory) {
  const hist = normalizeGradingHistory(chatHistory);
  const userMsgs = hist.filter((m) => m.role === 'user').map((m) => m.content);
  const herMsgs = hist.filter((m) => m.role === 'her').map((m) => m.content);

  const userPushedDate = userMsgs.some((m) => DATE_PUSH_RE.test(m));
  if (!userPushedDate) return false;

  const herYieldWithTime = herMsgs.some(
    (m) => YIELD_AGREE_RE.test(m) && TIME_OR_PLACE_RE.test(m)
  );
  if (herYieldWithTime) return true;

  const herAgreed = herMsgs.some((m) => YIELD_AGREE_RE.test(m));
  const herNamedTime = herMsgs.some((m) => TIME_OR_PLACE_RE.test(m));
  const userNamedTime = userMsgs.some((m) => TIME_OR_PLACE_RE.test(m));

  return herAgreed && herNamedTime && (userNamedTime || userPushedDate);
}

/** User is steering toward a meet (not just idle chat). */
function hasDateClosingProgress(chatHistory) {
  if (isDateScheduledAgreed(chatHistory)) return true;

  const hist = normalizeGradingHistory(chatHistory);
  const userLines = hist.filter((m) => m.role === 'user');

  if (userLines.some((m) => DATE_PUSH_RE.test(m.content))) return true;

  return userLines.some((m) => {
    const words = m.content.split(/\s+/).filter(Boolean).length;
    return words >= 6 && DATE_PUSH_RE.test(m.content);
  });
}

function analyzeHardGrading(chatHistory) {
  return {
    dateConfirmed: isDateScheduledAgreed(chatHistory),
    hasLazyInput: hasAnyLazyUserInput(chatHistory),
    hasClosingProgress: hasDateClosingProgress(chatHistory)
  };
}

/**
 * Enforce HARD grading caps on model score.
 * LAZY → max 39. No date → max 69. No closing progress → max 59.
 */
function applyHardScoreCaps(rawScore, chatHistory) {
  let score = Math.round(Number(rawScore) || 0);
  if (!Number.isFinite(score)) score = 50;
  score = Math.max(0, Math.min(100, score));

  const g = analyzeHardGrading(chatHistory);

  if (g.hasLazyInput) {
    return Math.min(score, 39);
  }

  if (!g.dateConfirmed) {
    score = Math.min(score, 69);
    if (!g.hasClosingProgress) {
      score = Math.min(score, 59);
    }
  }

  return score;
}

/** Injected into coach user prompt on hard so Gemini aligns before caps. */
function buildHardGradingPromptBlock(chatHistory) {
  const g = analyzeHardGrading(chatHistory);
  const lines = [
    '═══ HARD GRADING STATE (enforce in score) ═══',
    `DATE CONFIRMED (70-100 allowed): ${g.dateConfirmed ? 'YES' : 'NO — cap score at 69 max'}`,
    `LAZY USER INPUT DETECTED: ${g.hasLazyInput ? 'YES — cap below 40' : 'NO'}`,
    `CLOSING PROGRESS (date push / logistics): ${g.hasClosingProgress ? 'YES' : 'NO — idle chat cap below 60'}`
  ];
  return lines.join('\n');
}

const HARD_GRADING_RULES_TEXT = `GRADING LOGIC — HARD RULES (mandatory):

THE DATE GATE: If a date or meeting has NOT been successfully scheduled/agreed upon, the maximum score is 69. DO NOT give 70 or higher, no matter how clever or Alpha the input is.

THE REWARD: A score of 70-100 is ONLY unlocked once a clear date/time/location for a meeting is confirmed in the transcript (her agrees + time or place named).

LAZY INPUT PENALTY: Any lazy user message (1-2 words, "היי", "כן", "אוקיי" only, zero effort) → score MUST stay below 40, regardless of date status.

GOAL ORIENTED: Score based on moving toward closing the date. If he is just chatting without progress toward a meet, keep score below 60.`;

module.exports = {
  HARD_GRADING_RULES_TEXT,
  analyzeHardGrading,
  applyHardScoreCaps,
  buildHardGradingPromptBlock,
  isDateScheduledAgreed,
  hasAnyLazyUserInput,
  hasDateClosingProgress
};
