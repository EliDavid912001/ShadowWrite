/** Alpha simulator — realistic Israeli girl + coach */

const ROBOTIC_GIRL_RE =
  /מעניין|ספר עוד|ספר לי עוד|איך היה היום|איך היה היום שלך|אשמח לשמוע|מה דעתך|בוודאי אשמח|אני כאן בשבילך|איך אתה מרגיש|ספר על עצמך|פתח לי|תרגיש חופשי/i;

const SIMULATOR_FEW_SHOT = [
  {
    user: 'היי מה קורה',
    out: {
      isBeta: false,
      analysis: 'תגובה חזקה.',
      nextGirlReply: 'היי. אתה עצור או שזה סגנון?'
    }
  },
  {
    user: 'בסדר',
    out: {
      isBeta: true,
      analysis:
        'ענית במילה אחת ומפיל עליה את כל ההובלה. היא לא מרגישה גבר שמוביל — היא מרגישה שיחה מתה.',
      nextGirlReply: ''
    }
  },
  {
    user: 'חחח',
    out: {
      isBeta: true,
      analysis: 'חחח לבד זה לא מספיק. אין כיוון, אין מתח, אין מוביל.',
      nextGirlReply: ''
    }
  },
  {
    user: 'יודע. חמישי בערב אני פנוי — את?',
    out: {
      isBeta: false,
      analysis: 'תגובה חזקה.',
      nextGirlReply: 'חמישי אולי. תראה אם תצליח לשמור עליי עד אז 😏'
    }
  },
  {
    user: 'סורי אם עניתי מאוחר אני פשוט היה עסוק',
    out: {
      isBeta: true,
      analysis: 'התנצלות מיותרת + הסבר ארוך = בטא. אתה מוריד מעצמך בלי שהיא ביקשה.',
      nextGirlReply: ''
    }
  }
];

const SIMULATOR_SYSTEM = `אתה מפעיל סימולטור דייטים ישראלי. שני תפקידים — אל תערבב ביניהם.

תפקיד 1 — היא (מאיה, 24, תל אביב):
- מסתמסת בוואטסאפ כמו בן אדם אמיתי. לא עוזרת AI. לא מטפחת. לא מראיינת.
- הודעות קצרות: 2–18 מילים בדרך כלל. לפעמים מילה אחת: "חחח" "וואי" "ברור?"
- סלנג: יאללה, ברור, סבבה, מה נסגר, וואי, פיפס, חחח.
- אימוג'י: מקסימום 1 לפעמים, לא בכל הודעה.
- בודקת אותו: עקיצה, קור, פליי, לפעמים חמם — לפי מה שהוא כתב.
- אסור לחלוטין: "מעניין", "ספר עוד", "איך היה היום", "אשמח לשמוע", "מה דעתך", "ספר על עצמך".
- אם הוא יבש (כן/בסדר/חחח/אוקיי) — היא קרה או עוקצת: "זה התשובה?", "אתה תמיד ככה?", "יאללה ביי".
- אם הוא ערס/מוביל — מגיבה בטבעיות, אולי challenge קטן.

תפקיד 2 — מאמן (רק בשדה analysis):
- אם isBeta: 2–3 משפטים בעברית — מנגנון מדויק שנכשל.
- אם לא בטא: בדיוק המחרוזת: תגובה חזקה.

JSON בלבד.`;

function buildSimulatorPrompt(chatHistory, userReply) {
  const history = Array.isArray(chatHistory) ? chatHistory : [];
  const historyBlock =
    history.length > 0
      ? history
          .map((m) => {
            const who = m.role === 'assistant' || m.role === 'her' ? 'היא' : 'הוא';
            return `${who}: ${m.content}`;
          })
          .join('\n')
      : 'היא: היי, מה קורה? 😊';

  return `היסטוריית צ'אט (ישן → חדש):
${historyBlock}

ההודעה האחרונה שלו: "${String(userReply).trim()}"

נתח והחזר JSON:
{
  "isBeta": true/false,
  "analysis": "מאמן — ראה חוקים",
  "nextGirlReply": "רק אם isBeta=false: התשובה הבאה של מאיה בוואטסאפ. אם isBeta=true: \"\""
}

ALPHA = מוביל, ערס, קצר אבל עם עצם. לא מתנצל בלי סיבה.
BETA = נואש, מתנצל, מסביר יותר מדי, או יבש מדי שמפיל הובלה.`;
}

function buildSimulatorMessages(chatHistory, userReply) {
  const messages = [{ role: 'system', content: SIMULATOR_SYSTEM }];

  for (const ex of SIMULATOR_FEW_SHOT) {
    messages.push({ role: 'user', content: `הודעה שלו: "${ex.user}"\nJSON only.` });
    messages.push({ role: 'assistant', content: JSON.stringify(ex.out) });
  }

  messages.push({ role: 'user', content: buildSimulatorPrompt(chatHistory, userReply) });
  return messages;
}

function sanitizeGirlReply(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  if (ROBOTIC_GIRL_RE.test(t)) {
    const fallbacks = [
      'חחח אתה מצחיק',
      'וואי אתה עצור',
      'ברור. ומה עכשיו',
      'יאללה תראה',
      'אוקיי נשמע'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (t.length > 140) {
    t = t.split(/\s+/).slice(0, 18).join(' ');
  }
  return t;
}

function normalizeSimulatorResult(parsed, userReply) {
  const isBeta = Boolean(parsed.isBeta);
  const analysis =
    parsed.analysis ||
    (isBeta ? 'נפילת ערך — לא מוביל את השיחה.' : 'תגובה חזקה.');

  let nextGirlReply = '';
  if (!isBeta) {
    nextGirlReply = sanitizeGirlReply(parsed.nextGirlReply);
    if (!nextGirlReply) {
      nextGirlReply = pickFallbackGirlReply(userReply);
    }
  }

  return {
    isBeta,
    analysis: String(analysis).trim(),
    reframeHint: parsed.reframeHint || '',
    nextGirlReply
  };
}

function pickFallbackGirlReply(userReply) {
  const msg = String(userReply).trim();
  if (/^(כן|בסדר|חחח|אוקיי|נכון|טוב)$/i.test(msg)) {
    return 'זהו? חחח';
  }
  if (msg.length > 40) {
    return 'וואי הרבה מילים ביחד';
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

const SUMMARY_SYSTEM = `אתה מאמן דייטים ישראלי (סגנון ערס/אלפא). מסכם שיחת סימולציה בין גבר לבחורה בוואטסאפ.

חוקים:
- score: מספר שלם 0–100 (ציון כולל על הובלה, ערס, קצר, בלי נואשות).
- gradeLabel: אחת מ — חלש | בינוני | טוב | מצוין
- strengths: 2–4 משפטים קצרים בעברית — מה עבד טוב (ספציפי לשיחה).
- improvements: 2–4 משפטים קצרים בעברית — מה לשפר (ספציפי, actionable).
- summary: משפט אחד סיכום ישיר בעברית.
- אין אזהרות טכניות, אין "BUG", אין מילים באנגלית חוץ מ-JSON keys.
JSON בלבד.`;

function buildSimulatorSummaryMessages(chatHistory) {
  const history = Array.isArray(chatHistory) ? chatHistory : [];
  const historyBlock =
    history.length > 0
      ? history
          .map((m) => {
            const who = m.role === 'assistant' || m.role === 'her' ? 'היא' : 'הוא';
            return `${who}: ${m.content}`;
          })
          .join('\n')
      : 'אין הודעות';

  return [
    { role: 'system', content: SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `סיכום השיחה (ישן → חדש):
${historyBlock}

החזר JSON:
{
  "score": 0,
  "gradeLabel": "בינוני",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "summary": "..."
}`
    }
  ];
}

function normalizeSimulatorSummary(parsed) {
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const gradeMap = { חלש: 'חלש', בינוני: 'בינוני', טוב: 'טוב', מצוין: 'מצוין' };
  let gradeLabel = String(parsed.gradeLabel || '').trim();
  if (!gradeMap[gradeLabel]) {
    if (score >= 85) gradeLabel = 'מצוין';
    else if (score >= 70) gradeLabel = 'טוב';
    else if (score >= 45) gradeLabel = 'בינוני';
    else gradeLabel = 'חלש';
  }

  const strengths = (Array.isArray(parsed.strengths) ? parsed.strengths : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 5);
  const improvements = (Array.isArray(parsed.improvements) ? parsed.improvements : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 5);

  if (strengths.length === 0) {
    strengths.push('התחלת שיחה — יש בסיס להמשיך.');
  }
  if (improvements.length === 0) {
    improvements.push('קצר יותר, מוביל יותר, פחות הסברים מיותרים.');
  }

  return {
    score,
    gradeLabel,
    strengths,
    improvements,
    summary: String(parsed.summary || 'סיכום השיחה מוכן.').trim()
  };
}

module.exports = {
  SIMULATOR_SYSTEM,
  SUMMARY_SYSTEM,
  buildSimulatorMessages,
  buildSimulatorSummaryMessages,
  sanitizeGirlReply,
  normalizeSimulatorResult,
  normalizeSimulatorSummary,
  ROBOTIC_GIRL_RE
};
