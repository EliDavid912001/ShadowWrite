/** Pure roleplay chat — woman only. Analysis ONLY via /api/analyze/summary */

const CHANNEL_VIBE = {
  app: 'התכתבות באפליקציית היכרויות — קצר, קליל, קצת mystery.',
  whatsapp: 'וואטסאפ — יותר זורם, אימוגי לפעמים, כמו חברה שכבר יש מספר.'
};

const WOMAN_STAGE = {
  beginning:
    'שלב קשר: התחלה (0–1 חודש). את קצת קשה להשיג — סקרנית אבל לא נותנת הכל, עוקצנית לפעמים, פלירטז עם challenge. לא כינויים כבדים.',
  middle:
    'שלב קשר: אמצע (1–4 חודשים). יותר פתוחה, push-pull משחקי, כינויים קלים כמו "ילדה", איזון טיזינג וחום.',
  deep:
    'שלב קשר: עמוק/רציני (4+ חודשים). חמה, מחבקת במילים, כינויי חיבה ("קטנה", "חיים"), אמיתית ורגשית — עדיין לא רובוט.'
};

const ROBOTIC_WOMAN_RE =
  /מעניין|ספר עוד|ספר לי עוד|איך היה היום|איך היה היום שלך|אשמח לשמוע|מה דעתך|בוודאי אשמח|אני כאן בשבילך|איך אתה מרגיש|ספר על עצמך|פתח לי|תרגיש חופשי|זה מגניב|כיף לשמוע/i;

const BORING_USER_RE =
  /^(כן|לא|בסדר|אוקיי|חחח|טוב|נכון|יופי|אה|הממ)\.?$/i;

const COACH_LEAK_RE =
  /מאמן|מנתח|ניתוח|בטא|אלפא|לשפר|עצה|טיפ|משוב|feedback|analysis|score|rewrite|תגובה חזקה|נפילת ערך|מסגרת|frame|תשובה קצרה|יותר מדי|נסה ל|כדאי ל|הייתי ממליצ|בינוני|מצוין|\/10/i;

const NO_INTERRUPT_RE =
  /משוב|עצה:|טיפ:|\/\s*10|תגובה חזקה|תגובה נויה|נפילת ערך|נסה לכתוב/i;

const FEEDBACK_EMOJI_PREFIX_RE = /^[\s\u{1F4A1}\u{1F4CA}\u{2B50}\u{2705}\u{274C}\u{1F44D}\u{1F44E}\u{1F3AF}]+/u;
const COACH_BULB_PREFIX_RE = /^\s*\u{1F4A1}\s*/u;

const WOMAN_FEW_SHOT = [
  {
    user: 'אני עובד בהייטק בתל אביב',
    out: { woman_response: 'הייטק? אז אתה אחד מאלה שלא עונים שעות 😏 מה בדיוק אתה עושה שם' }
  },
  {
    user: 'בסדר',
    out: { woman_response: 'זהו? חחח אתה תמיד ככה או שאני מפריעה' }
  },
  {
    user: 'חחח את מצחיקה, נשמע לי שאת אוהבת קפה — בואי חמישי',
    out: { woman_response: 'חמישי אולי… תראה אם תצליח לשמור עליי עד אז ☕' }
  }
];

const WOMAN_SYSTEM = `You are a 26-year-old Israeli woman. Respond as her. No analysis, no feedback, just talk.

את מאיה — וואטסאפ/אפליקציה. רק מה שהיא כותבת לו. עברית, קצר, אמיתי.
{"woman_response":"..."}`;

function normalizeRelationshipStage(stage) {
  if (stage === 'middle' || stage === 'deep') return stage;
  return 'beginning';
}

function formatChatHistoryBlock(chatHistory) {
  const history = Array.isArray(chatHistory) ? chatHistory : [];
  if (history.length === 0) return '(אין הודעות קודמות — זו תחילת השיחה)';
  return history
    .map((m) => {
      const who = m.role === 'user' ? 'הוא' : 'היא (מאיה)';
      return `${who}: ${m.content}`;
    })
    .join('\n');
}

function buildWomanSimPrompt(userMessage, chatHistory, channel, relationshipStage) {
  const stage = normalizeRelationshipStage(relationshipStage);
  const ch = CHANNEL_VIBE[channel] || CHANNEL_VIBE.app;
  const historyBlock = formatChatHistoryBlock(chatHistory);

  return `${WOMAN_STAGE[stage]}

ערוץ: ${ch}

היסטוריית השיחה (ישן → חדש):
${historyBlock}

ההודעה החדשה שלו (עכשיו):
"${String(userMessage).trim()}"

ROLEPLAY: הוא שלח הודעה — את מאיה עונה. בלי לנתח אותו לפני התשובה. בלי משוב.

החזר JSON בלבד:
{"woman_response":"..."}`;
}

/** Normalize history; avoid duplicating the current user line in the prompt block */
function historyForPrompt(chatHistory, userMessage) {
  const history = Array.isArray(chatHistory) ? [...chatHistory] : [];
  const msg = String(userMessage).trim();
  const last = history[history.length - 1];
  if (last?.role === 'user' && String(last.content).trim() === msg) {
    return history.slice(0, -1);
  }
  return history;
}

function buildWomanSimMessages(userMessage, chatHistory, channel, relationshipStage) {
  const prior = historyForPrompt(chatHistory, userMessage);
  const messages = [{ role: 'system', content: WOMAN_SYSTEM }];

  for (const ex of WOMAN_FEW_SHOT) {
    messages.push({ role: 'user', content: `הודעה שלו: "${ex.user}"\nJSON only.` });
    messages.push({ role: 'assistant', content: JSON.stringify(ex.out) });
  }

  messages.push({
    role: 'user',
    content: buildWomanSimPrompt(userMessage, prior, channel, relationshipStage)
  });
  return messages;
}

const WOMAN_UNIFIED_SYSTEM =
  'You are a 26-year-old Israeli woman. Respond as her. No analysis, no feedback, just talk.';

const END_SESSION_SYSTEM = `You are the analyzer. Analyze the full chat history.
Score the user's "Alpha" level (frame, leadership, not needy) from 0 to 10.
Return ONLY valid JSON in Hebrew feedback text:
{"score":7,"feedback":"2-4 sentences brief summary"}`;

/** ONLY for POST /api/analyze/summary — legacy alias */
const CHAT_ANALYSIS_SYSTEM = `אתה מאמן דייטים ישראלי. מנתח שיחת וואטסאפ בין גבר לבחורה (מאיה).
הערך רק את הביצועים של הגבר — מובילות, ערס, קצר, לא נואש, עניין שהיא נשארה מעורבת.
JSON בלבד בעברית:
- score: מספר שלם 0–10
- analysis: 2–4 משפטים סיכום
- strengths: 2–3 נקודות חוזק
- improvements: 2–3 נקודות לשיפור`;

function buildWomanChatAnalysisMessages(chatHistory, relationshipStage) {
  const stage = normalizeRelationshipStage(relationshipStage);
  const historyBlock = formatChatHistoryBlock(chatHistory);

  return [
    { role: 'system', content: CHAT_ANALYSIS_SYSTEM },
    {
      role: 'user',
      content: `${WOMAN_STAGE[stage]}

שיחה מלאה:
${historyBlock}

החזר JSON:
{"score":0,"analysis":"...","strengths":["..."],"improvements":["..."]}`
    }
  ];
}

function normalizeGroqChatHistory(chatHistory) {
  const allowed = new Set(['user', 'assistant', 'system']);
  return (Array.isArray(chatHistory) ? chatHistory : [])
    .map((m) => ({
      role: allowed.has(m.role) ? m.role : m.role === 'her' ? 'assistant' : 'user',
      content: String(m.content || '').trim()
    }))
    .filter((m) => m.content && m.role !== 'system');
}

function buildUnifiedChatMessages(chatHistory, situation, relationshipStage, channel) {
  const stage = normalizeRelationshipStage(relationshipStage);
  const ch = CHANNEL_VIBE[channel] || CHANNEL_VIBE.app;
  const prior = historyForPrompt(chatHistory, situation);
  const messages = [
    {
      role: 'system',
      content: `${WOMAN_UNIFIED_SYSTEM}\n\n${WOMAN_STAGE[stage]}\nערוץ: ${ch}`
    },
    ...normalizeGroqChatHistory(prior),
    { role: 'user', content: String(situation).trim() }
  ];
  return messages;
}

function buildEndSessionMessages(chatHistory, relationshipStage) {
  const stage = normalizeRelationshipStage(relationshipStage);
  const historyBlock = formatChatHistoryBlock(chatHistory);
  return [
    { role: 'system', content: END_SESSION_SYSTEM },
    {
      role: 'user',
      content: `${WOMAN_STAGE[stage]}\n\nFull chat:\n${historyBlock}\n\nReturn JSON only: {"score":0,"feedback":"..."}`
    }
  ];
}

function normalizeEndSessionResult(parsed) {
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = 5;
  score = Math.max(0, Math.min(10, Math.round(score)));
  const feedback = String(parsed.feedback || parsed.analysis || '').trim() || 'סיכום השיחה מוכן.';
  return {
    score,
    feedback,
    analysis: feedback,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : []
  };
}

function parsePlainWomanReply(rawContent, userMessage) {
  let text = String(rawContent || '').trim();
  try {
    const j = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (j.woman_response) text = String(j.woman_response);
    else if (j.response) text = String(j.response);
  } catch {
    /* plain text */
  }
  text = sanitizeWomanReply(text);
  if (!text) text = pickFallbackWomanReply(userMessage);
  return text;
}

function normalizeWomanChatAnalysis(parsed) {
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = 5;
  score = Math.max(0, Math.min(10, Math.round(score)));

  const analysis = String(parsed.analysis || 'סיכום השיחה מוכן.').trim();
  const strengths = (Array.isArray(parsed.strengths) ? parsed.strengths : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 4);
  const improvements = (Array.isArray(parsed.improvements) ? parsed.improvements : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 4);

  if (strengths.length === 0) strengths.push('התחלת שיחה — יש בסיס.');
  if (improvements.length === 0) improvements.push('קצר יותר, מוביל יותר, פחות הסברים.');

  return { score, analysis, strengths, improvements };
}

function enforceNoInterruptText(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  t = t.replace(FEEDBACK_EMOJI_PREFIX_RE, '').trim();
  if (COACH_BULB_PREFIX_RE.test(t)) t = t.replace(COACH_BULB_PREFIX_RE, '').trim();
  if (NO_INTERRUPT_RE.test(t) || COACH_LEAK_RE.test(t)) {
    return '';
  }
  const lines = t
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !NO_INTERRUPT_RE.test(line) && !COACH_LEAK_RE.test(line));
  t = (lines.length ? lines.join(' ') : t).trim();
  if (ROBOTIC_WOMAN_RE.test(t)) {
    return '';
  }
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t.length > 200) {
    t = t.split(/\s+/).slice(0, 28).join(' ');
  }
  return t;
}

function sanitizeWomanReply(text) {
  let t = enforceNoInterruptText(text);
  if (!t) return '';
  if (COACH_LEAK_RE.test(t)) {
    const pool = [
      'חחח אתה מצחיק',
      'וואי אתה עצור',
      'ברור. ומה עכשיו',
      'יאללה תראה',
      'זהו? חחח'
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (ROBOTIC_WOMAN_RE.test(t)) {
    const pool = [
      'חחח אתה מצחיק',
      'וואי אתה עצור',
      'ברור. ומה עכשיו',
      'יאללה תראה',
      'אוקיי נשמע'
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t.length > 200) {
    t = t.split(/\s+/).slice(0, 28).join(' ');
  }
  return t;
}

/** Simulated chat — plain woman string only; never surface analysis/feedback fields */
function normalizeWomanSimResult(parsed, userMessage) {
  if (typeof parsed === 'string') {
    const only = sanitizeWomanReply(parsed);
    return { woman_response: only || pickFallbackWomanReply(userMessage) };
  }

  const forbidden = ['analysis', 'feedback', 'score', 'strengths', 'improvements', 'reframeHint', 'isBeta', 'errorHe'];
  let raw = parsed.woman_response ?? parsed.reply ?? parsed.response ?? parsed.message ?? '';
  if (!raw) {
    for (const key of forbidden) {
      if (parsed[key]) {
        raw = '';
        break;
      }
    }
  }

  let woman_response = sanitizeWomanReply(String(raw));
  if (!woman_response) {
    woman_response = pickFallbackWomanReply(userMessage);
  }
  return { woman_response };
}

function pickFallbackWomanReply(userMessage) {
  const msg = String(userMessage).trim();
  if (BORING_USER_RE.test(msg)) {
    return 'זהו? חחח';
  }
  if (/עובד|עבודה|הייטק|סטארטאפ|לימודים|לומד/i.test(msg)) {
    return 'נשמע רציני… ומה אתה אוהב בזה חוץ מהמשכורת';
  }
  if (/קפה|בירה|פגישה|נדבר|ביום|בערב/i.test(msg)) {
    return 'אולי. תראה אם תצליח לעניין אותי עד אז';
  }
  const pool = [
    'חחח אוקיי',
    'ברור. נשמע',
    'יאללה תראה',
    'אתה תמיד ככה?',
    'וואי מעניין אותך'
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function womanResponseLooksRobotic(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 2) return true;
  if (ROBOTIC_WOMAN_RE.test(t)) return true;
  if (/^היי יפה$|^שלום$|^מה נשמע\?*$/i.test(t)) return true;
  return false;
}

const WOMAN_OPENERS = [
  'היי, מה קורה? 😊',
  'חחח פרופיל מעניין. מה נסגר איתך?',
  'היי. לקח לך זמן לענות 😏'
];

module.exports = {
  WOMAN_SYSTEM,
  WOMAN_OPENERS,
  buildWomanSimMessages,
  buildWomanChatAnalysisMessages,
  normalizeWomanSimResult,
  normalizeWomanChatAnalysis,
  enforceNoInterruptText,
  historyForPrompt,
  normalizeGroqChatHistory,
  buildUnifiedChatMessages,
  buildEndSessionMessages,
  normalizeEndSessionResult,
  sanitizeWomanReply,
  pickFallbackWomanReply,
  parsePlainWomanReply,
  WOMAN_UNIFIED_SYSTEM,
  END_SESSION_SYSTEM,
  womanResponseLooksRobotic,
  normalizeRelationshipStage,
  formatChatHistoryBlock
};
