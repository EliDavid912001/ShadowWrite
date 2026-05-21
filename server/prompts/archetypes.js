const CHANNEL_CTX = {
  app: 'אפליקציית היכרויות — קצר, low investment',
  whatsapp: 'וואטסאפ — חם יותר אבל לא over-text',
  phone: 'טלפון — משפטים שנשמעים בקול, לא טקסט חכם',
  inperson: 'פנים מול פנים — פעולה או משפט אחד'
};

const ANALYZE_SYSTEM = `אתה כותב 4 הודעות וואטסאפ לגבר ישראלי. עברית עממית/רחוב בלבד.
הדוגמאות = סגנון Ars-Lite / סימפ / קוקי / צ'יל — אסור להעתיק אותן מילה במילה. התאם לסיטואציה.
ב-alpha: אסור סימן שאלה, אסור "אולי", אסור "מה בא לך".`;

const ANALYZE_FEW_SHOT = [
  {
    situation: 'אני פנויה הערב',
    out: {
      alpha: 'שומעת. תתארגני ל-21:00. אוסף אותך לדרינק בפלורנטין.',
      beta: 'וואי איזה כיף 😅 מה בא לך לעשות? אני פנוי מתי שתרצי.',
      witty: 'פנויה? אל תעופי, יש תור. אבל אולי אמצא לך חלון בערב.',
      friendly: 'אש. בואי בירה בערב — הכי בקליל.'
    }
  },
  {
    situation: 'אתה חושב שאתה יכול להשיג אותי חחח',
    out: {
      alpha: 'שומעת. ברור שכן. סוף.',
      beta: 'למה את חושבת ככה? רק רוצה שנהיה בסדר 😅',
      witty: 'אני לא חושב. אני הפרס. תגידי אם טעיתי.',
      friendly: 'חחח. בואי קפה — בלי משחקים.'
    }
  },
  {
    situation: 'חזרה רק חחח',
    out: {
      alpha: 'חחח זה לא תשובה. דברי.',
      beta: 'חחח אהבתי! מה שלומך? 😊',
      witty: 'נגמרו המילים אצלך או שאת בודקת?',
      friendly: 'חחח. מה קורה.'
    }
  }
];

function buildAnalyzePrompt(situation, channel) {
  const ch = CHANNEL_CTX[channel] || CHANNEL_CTX.app;
  const trimmed = String(situation).trim();
  const spoken = channel === 'phone' || channel === 'inperson';

  return `
TASK: Write 4 text messages for an Israeli dating scenario.
CHANNEL: ${ch}
SITUATION / HER MESSAGE: "${trimmed}"

CRITICAL HEBREW RULES (MUST FOLLOW):
- Write ONLY in 100% natural, street-level Israeli Hebrew (עברית עממית, סלנג רחוב).
- FORBIDDEN WORDS: תוכניותיך, ניתן, סורי, האם, אשמח, מדוע, ביחד, אפשר, מעניין, יפהפייה.
- In "alpha" ONLY — also forbidden: אולי, ?, "מה בא לך", "מה תעשי".
- DO NOT copy the Good Examples below word-for-word. Adapt to SITUATION.

ARCHETYPES & PERSONALITIES:

1. "alpha": The Dominant "Ars-Lite" (ערס לייט — ביטחון עצמי, גבר-גבר).
   - Personality: Street-smart, dominant, zero hesitation. Commands, not questions.
   - Slang: שומעת, יאללה, סגור, תתארגני.
   - If she is free → tell her the plan (time + place). No asking what she wants.
   - Style ref: "שומעת, תתארגני ל-21:00. אוסף אותך לדרינק."
   - Style ref 2: "יאללה סגור. תהיי למטה ב-20:30."

2. "beta": The Needy Simp (גבר מרצה ונואש).
   - Over-excited, pedestal, asks permission. Emojis 😅 🙏 😊.
   - Style ref: "וואי איזה כיף 😅 מה בא לך לעשות? אני אזרום איתך לאן שרק תרצי."

3. "witty": The Playful Arrogant (קוקי-פאני / עוקצני).
   - Push/pull, teases, he is the prize. "אולי" OK here only.
   - Style ref: "פנויה? אל תעופי, יש תור. אבל נראה, אם היית ילדה טובה השבוע אולי אמצא חלון."

4. "friendly": The Chill Bro (זורם, בלי לחץ).
   - Style ref: "אש. בואי בירה בערב, הכי בקליל."

SUBTEXT:
- Green light (פנויה/פנוי) → alpha dictates meetup.
- Shit test (חושב שתצליח) → alpha holds frame, no instant date.
- Cold/dry → alpha short, no chase.

${spoken ? 'Phone/in-person: 1-2 spoken sentences per key.' : ''}

Return ONLY raw JSON. No markdown.
{"alpha":"...","beta":"...","witty":"...","friendly":"..."}`;
}

function buildAnalyzeMessages(situation, channel) {
  const messages = [{ role: 'system', content: ANALYZE_SYSTEM }];

  for (const ex of ANALYZE_FEW_SHOT) {
    messages.push({
      role: 'user',
      content: `סיטואציה: "${ex.situation}"\nReturn JSON only.`
    });
    messages.push({ role: 'assistant', content: JSON.stringify(ex.out) });
  }

  messages.push({ role: 'user', content: buildAnalyzePrompt(situation, channel) });
  return messages;
}

function sanitizeResponseText(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();
  const replacements = [
    [/אשמח/gi, ''],
    [/מעניין/gi, ''],
    [/האם\s/gi, ''],
    [/סורי/gi, ''],
    [/נדבר על הכל/gi, 'נדבר'],
    [/מה את רוצה לעשות/gi, 'מה בא לך'],
    [/היי יפה/gi, 'היי']
  ];
  for (const [re, rep] of replacements) t = t.replace(re, rep);
  return t.replace(/\s{2,}/g, ' ').trim();
}

function sanitizeResponses(responses) {
  const out = {};
  for (const key of ['alpha', 'beta', 'witty', 'friendly']) {
    out[key] = sanitizeResponseText(responses[key]);
  }
  return out;
}

const FORBIDDEN_ALPHA_RE =
  /תוכניותיך|ניתן|סורי|האם|אשמח|מדוע|מעניין|יפהפייה|מדהים|נדבר על הכל|מה את רוצה/gi;

const COPY_PASTE_ALPHA_RE =
  /שומעת, תתארגני ל-21:00\. אני אוסף אותך עם האופנוע|יאללה סגור\. תהיי למטה ב-20:30/;

function detectSituationKind(situation) {
  const s = String(situation);
  if (/פנוי|פנויה|פנויות|יש לי זמן|available/i.test(s)) return 'green_light';
  if (/חושב.*(יכול|תצליח|תוכל)|מסוגל|להשיג|לגייס/i.test(s)) return 'shit_test';
  if (/^חחח|חזר.*חחח|רק חחח/i.test(s)) return 'dry_laugh';
  return 'general';
}

function enforceAlphaRules(situation, responses) {
  const kind = detectSituationKind(situation);
  const s = String(situation).trim();
  let alpha = sanitizeResponseText(responses.alpha || '');

  const alphaBroken =
    !alpha ||
    alpha.length < 6 ||
    /\?/.test(alpha) ||
    /\bאולי\b/i.test(alpha) ||
    /מה תעש|מה בא לך|מה את|מה תרצ|מה נעשה|אני פנוי|היום אני|על היום/i.test(alpha) ||
    (s.length > 8 && alpha.includes(s.slice(0, Math.min(12, s.length))));

  if (kind === 'green_light' && alphaBroken) {
    alpha = 'שומעת. תתארגני ל-21:00. אוסף אותך לדרינק.';
  } else if (kind === 'shit_test' && (alphaBroken || /תתארגני|דרינק|21:00|אוסף אותך/i.test(alpha))) {
    alpha = 'שומעת. ברור שכן. סוף.';
  } else if (kind === 'dry_laugh' && (alphaBroken || /מעניין|מה שלומך/i.test(alpha))) {
    alpha = 'חחח זה לא תשובה. דברי.';
  } else if (alphaBroken) {
    alpha = 'יאללה סגור. נדבר עכשיו.';
  }

  responses.alpha = alpha;
  return responses;
}

function responsesLookRobotic(responses) {
  const a = responses.alpha || '';
  if (FORBIDDEN_ALPHA_RE.test(a)) return true;
  if (/\?/.test(a)) return true;
  if (/\bאולי\b/i.test(a)) return true;
  if (/מה תעש|מה בא לך|מה את רוצה|על היום אני/i.test(a)) return true;
  if (COPY_PASTE_ALPHA_RE.test(a)) return true;
  if (/מוכן להכל|נהדר|ממש מקווה|לעשות משהו|אולי ניפגש/i.test(Object.values(responses).join(' ')))
    return true;
  return false;
}

function buildAlphaSimPrompt(userMessage, conversationContext) {
  return `Hyper-realistic Israeli dating simulator — Elite Coach + Girl dynamics.

BETA: needy, apologetic, over-investing, OR dry 1-word ("בסדר","כן","חחח") forcing her to lead.
ALPHA: Ars-Lite — שומעת, יאללה, סגור, leads frame.

USER MESSAGE: "${userMessage.trim()}"
CONTEXT: ${conversationContext || 'opening'}

Return ONLY JSON:
{
  "isBeta": true|false,
  "analysis": "If beta: 3-sentence deep Hebrew psychological breakdown naming exact mechanic. If alpha: 'תגובה חזקה.'",
  "nextGirlReply": "If not beta: natural cold/warm Israeli girl reply — NO 'מעניין' filler. If beta: \"\""
}`;
}

module.exports = {
  CHANNEL_CTX,
  ANALYZE_SYSTEM,
  buildAnalyzePrompt,
  buildAnalyzeMessages,
  sanitizeResponses,
  enforceAlphaRules,
  detectSituationKind,
  responsesLookRobotic,
  buildAlphaSimPrompt
};
