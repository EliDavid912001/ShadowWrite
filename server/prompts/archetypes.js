const CHANNEL_CTX = {
  app: 'טינדר/באמבל',
  whatsapp: 'וואטסאפ',
  phone: 'טלפון',
  inperson: 'פרונט'
};

const STAGE_CTX = {
  beginning:
    'שלב: התחלה (0 עד חודש). רק הכרתם. אווירה: קלילה, מסתורית, לא מחייבת. בשום אופן אל תשתמש בכינויים כבדים כמו "קטנה שלי". שמור על מתח גבוה.',
  middle:
    'שלב: אמצע (1 עד 4 חודשים). יוצאים בעקביות. אווירה: נינוחה, משחקי דחיפה-משיכה (Push/Pull) משעשעים. אתה יכול להשתמש בכינויים קלילים כמו "ילדה". איזון טוב בין טיזינג (עקיצות) לבין בניית חיבור.',
  deep:
    'שלב: קשר עמוק/רציני (4+ חודשים). מערכת יחסים מבוססת. אווירה: אמון גבוה. אתה *יכול* להשתמש בכינויי חיבה כמו "קטנה שלי", אבל אתה שומר על מסגרת גברית ויציבה.'
};

function normalizeRelationshipStage(stage) {
  if (stage === 'middle' || stage === 'deep') return stage;
  return 'beginning';
}

const ANALYZE_SYSTEM = `בחור ישראלי 26 בוואטסאפ. לא AI. אלפא = Tactician: עברית מושלמת, 3-10 מילים, קסם מחושב + push-pull + ולידציה מותנית. סמכות מוחלטת, חלק, חידתי. בלי תחנונים/התנצלות. פרידה=חתוך אדיש.`;

/** Injected into 4-Answers system prompt (promptManager SCENARIO_PROMPT) */
const ALPHA_ARCHETYPE_BLOCK = `═══ ALPHA (אלפא — THE TACTICIAN) — HIGHEST PRIORITY (read first) ═══
HEBREW QUALITY (non-negotiable): The "alpha" field MUST be 100% flawless native Israeli Hebrew. Zero typos, zero calques, zero AI-formal words (אשמח, בוודאי, ניתן, מדוע, היכן, תוכניותיך). If it sounds robotic — rewrite before output.

PSYCHOLOGY: Calculated charm + dark psychology. He is NOT dry, NOT insulting on first contact. He uses TACTICAL AFFECTION and CONDITIONAL VALIDATION to lower her defenses and captivate her — but always from a position of absolute authority and high value. Every line either gives a tiny "win" then withdraws (push-pull), or makes an observation that subtly tests her ("יש בך משהו...", "נראה אם...").

TONE: Smooth, highly confident, engaging, slightly mysterious. He LEADS the frame completely. Never defensive, never explaining, never chasing.

STRUCTURE: 3 to 10 words. Single line. NO period at end.

EMOJIS: Avoid emojis in Alpha — the power is in the words. A single 😉 is tolerated, never anything desperate.

PET NAMES (kicking in by stage):
• beginning → NO pet names yet (קטנטונת/מתוקה/קטנה שלי forbidden — too early, weakens frame).
• middle → ילדה / מתוקה allowed lightly, only when she's warm.
• deep → קטנה שלי / קטנטונת / מתוקה שלי allowed and preferred when she's warm.
NEVER use pet names on a fight, breakup, cold demand, or hard test — regardless of stage.

SITUATION PLAYBOOK (Tactician moves):
• First contact / cold opener → tactical interest: "יש לך וייב שקשה להתעלם ממנו, נראה אם את שווה את זה"
• Shit-test / "אתה חושב שאתה מיוחד?" → smooth flip + ownership: "לא חושב, יודע — את עוד תבחני בעצמך"
• Hard demand / "אתה חייב לבוא" → boundary without rudeness: "לא ככה זה עובד פה"
• Love test / "אוהב אותי?" → conditional dodge: "תלוי כמה את שווה את זה היום"
• Domestic flip → smooth ownership: "הפוך תכיני לי קודם, נראה איך תצליחי"
• Breakup / "לא מתאים" → cold cut, zero fight: "סגור בהצלחה", "קיבלתי ביי"
• חחח / dry → light tease back: "נחנקת שם, או שיש לך מה להגיד"

FORBIDDEN FOR ALPHA (these = instant Beta):
• Raw needy validation: "אוהב אותך", "מתגעגע אלייך", "בא לי אותך", "את מדהימה", "את מהממת", "יפה שלך".
• AI-formal politeness: "אשמח", "בוודאי", "מדוע", "היכן", "ניתן", "תוכניותיך".
• Apologies/begging: "סליחה", "סורי", "מצטער", "מתנצל", "בבקשה תני הזדמנות".
• Period at end. Multiple lines.`;

const ALPHA_MIN_WORDS = 3;
const ALPHA_MAX_WORDS = 10;

const VALIDATION_BY_STAGE = {
  beginning: [
    'תלוי כמה את שווה את זה',
    'יש בך משהו מסקרן, נראה',
    'נראה אם תוכיחי את זה',
    'אל תעופי על עצמך מהר מדי',
    'שומר על זכות השתיקה'
  ],
  middle: [
    'תלוי אם התנהגת יפה ילדה',
    'יש בך משהו, ילדה',
    'אל תעופי על עצמך מתוקה',
    'נראה אם את עומדת בקצב'
  ],
  deep: [
    'תלוי כמה את שווה את זה קטנה',
    'יש בך משהו שלא נמאס',
    'קטנה שלי את יודעת כבר',
    'תוכיחי לי שוב מתוקה'
  ]
};

const DOMESTIC_BY_STAGE = {
  beginning: ['הפוך תכיני קודם, נראה איך', 'את בבית — תתחילי את', 'תוכיחי שאת יודעת לבשל'],
  middle: ['הפוך ילדה תכיני קודם', 'את בבית, נראה מה את שווה', 'תבשלי ונראה את מה את יודעת'],
  deep: ['קטנה שלי תכיני קודם, אני בא', 'הפוך תכיני לי, נראה אותך', 'את בבית קטנה, תפתיעי אותי']
};

const HEAVY_NICKNAME_RE = /קטנה שלי|חיים שלי|נשמה שלי|אהובה שלי|הכל שלי/i;

const BREAKUP_ALPHA_FALLBACKS = [
  'סגור בהצלחה',
  'הכל טוב אחלה חיים',
  'קיבלתי ביי'
];

const BREAKUP_SITUATION_RE =
  /להפרד|להיפרד|נפרד|ניפרד|שניפרד|נפרדים|נפרדת|נפרדנו|פרידה|לא מתאים|זה לא עובד|לא עובד לי|אני רוצה לעזוב|רוצה לעזוב|נגמר לנו|לא רוצה יותר|ביטול|לא מרגישה|לא מרגיש|לא אוהבת|לא אוהב/i;

const WEAK_BREAKUP_ALPHA_RE =
  /למה|בבקשה|מה עשיתי|תדברי|תסבירי|אל תעזבי|תחכי|אל תלכי|בואי נדבר|אני מצטער|סליחה|תני הזדמנות/i;

function buildAnalyzePrompt(situation, relationshipStage) {
  const trimmed = String(situation).trim();
  const stage = normalizeRelationshipStage(relationshipStage);
  const stageText = STAGE_CTX[stage];

  return `
שכח מכל החוקים הקודמים. אל תתנהג כמו בינה מלאכותית.
אתה גבר ישראלי אמיתי ואותנטי בן 26 שמסתמס בוואטסאפ.

הקשר מערכת היחסים:
${stageText}

חוקים אנושיים קריטיים:
1. אורך: בין 2 ל-7 מילים מקסימום עבור האלפא.
2. פיסוק: אל תשים נקודה (.) בסוף המשפטים שלך!
3. עברית שפת אם בלבד: אל תתרגם ביטויים מאנגלית.

ההודעה שלה: "${trimmed}"

🚨 חוק חירום: פרידות וברקסים (Breakups) 🚨
אם ההודעה שלה היא פרידה, ביטול הקשר או "לא מתאים לי" (למשל: "אני רוצה להפרד", "זה לא עובד"):
- האלפא: חותך מיד באדישות. לעולם לא נלחם, לא מבקש הסברים ולא שואל שאלות. אומר לה בהצלחה וסוגר עניין. דוגמאות: "סגור. בהצלחה", "הכל טוב, אחלה חיים", "קיבלתי. ביי".
- הבטא: נכנס לפאניקה, מתחנן, לוקח את האשמה עליו. דוגמא: "מה?? למה? מה עשיתי לא בסדר? בבקשה בואי נדבר על זה 😭"

תענה ב-4 הוויבים האנושיים האלה (אם זו לא פרידה, התעלם מחוק החירום):

1. "alpha" (אלפא): סמכות מוחלטת, גבולות, ערך גבוה — לא פלרטוט ולא ולידציה.
   - עברית מושלמת כמו ישראלי 26. בלי טעויות כתיב או ניסוח רובוטי.
   - 2-8 מילים בלבד. push-pull. אדיש. מוביל.
   - אסור: שמח ש..., איזה כיף, מתוקה שלי בבדיקות, התנצלות, הסברים ארוכים.
   - רגשות/בדיקות: עקיצה ("תלוי כמה חפרת", "חיה בסרט").
   - מטלות/בישול: הפוך עליה ("הפוך ילדה תבשלי").
   - פרידה: חותך מיד ("סגור בהצלחה", "קיבלתי ביי").

2. "beta" (בטא): הגבר שמשקיע יותר מדי.
   - מתאמץ, מסביר את עצמו בהגזמה, נלחץ מכל שינוי קטן, משתמש באימוג'יז (😅, ❤️, 🙏).

3. "witty" (שנון): הגבר העוקצני והחצוף.
   - טיזינג טהור, משחק איתה.
   - בפרידה: עוקץ אותה חזרה. (למשל: "מי זאת?", "סוף סוף, חיכיתי שתגידי את זה").

4. "friendly" (חברי): האח הזורם.
   - רגיל, ישיר, בלי משחקים אגו.
   - בפרידה: מכבד ונפרד יפה. (למשל: "הכל טוב, שיהיה בהצלחה").

החזר אך ורק אובייקט JSON גולמי. ללא markdown.
{"alpha":"...","beta":"...","witty":"...","friendly":"..."}`;
}

function buildAnalyzeMessages(situation, channel, relationshipStage) {
  const stage = normalizeRelationshipStage(relationshipStage);
  return [{ role: 'user', content: buildAnalyzePrompt(situation, stage) }];
}

function stripTrailingPeriods(text) {
  return String(text)
    .trim()
    .replace(/\.+$/g, '')
    .trim();
}

function trimAlphaWords(text, maxWords = ALPHA_MAX_WORDS) {
  const words = stripTrailingPeriods(text).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

function sanitizeResponseText(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();
  /**
   * Strip AI-formal Hebrew (these break the Tactician voice).
   * NOTE: "מעניין" is intentionally NOT stripped — the Tactician uses it
   * ("יש בך משהו מסקרן/מעניין" is a valid tactical observation).
   */
  const replacements = [
    [/אשמח/gi, ''],
    [/סורי/gi, ''],
    [/בוודאי/gi, 'ברור'],
    [/מדוע/gi, 'למה'],
    [/היכן/gi, 'איפה'],
    [/ניתן/gi, ''],
    [/תוכניותיך/gi, '']
  ];
  for (const [re, rep] of replacements) t = t.replace(re, rep);
  return t.replace(/\s{2,}/g, ' ').trim();
}

function sanitizeResponses(responses) {
  const out = {};
  for (const key of ['alpha', 'beta', 'witty', 'friendly']) {
    out[key] = sanitizeResponseText(responses[key]);
  }
  out.alpha = trimAlphaWords(out.alpha);
  return out;
}

function normalizeScore(value) {
  let score = Number(value);
  if (!Number.isFinite(score)) score = 5;
  return Math.max(0, Math.min(10, Math.round(score)));
}

function normalizeFeedback(text, score) {
  const fb = String(text || '').trim();
  if (fb) return fb;
  if (score >= 8) return 'יש פוטנציאל אלפא/שנון חזק — שמור על קצר ומוביל.';
  if (score >= 5) return 'בינוני — אפשר לחדד עקיצה ולהפחית נואשות.';
  return 'נמוך — יותר מדי בטא/ריכוך; צריך מסגרת וערס.';
}

/** מפריד ארכיטיפים מ-score/feedback לפני enforceAlphaRules */
function extractAnalyzePayload(raw) {
  const score = normalizeScore(raw?.score);
  const feedback = normalizeFeedback(raw?.feedback, score);
  const responses = sanitizeResponses(raw || {});
  return { responses, score, feedback };
}

/**
 * AI-formal politeness and direct fawning praise (still forbidden for Tactician).
 * "מעניין" is REMOVED — Tactician uses it observationally.
 */
const FORBIDDEN_ALPHA_RE =
  /תוכניותיך|ניתן|יפהפייה|בוודאי|אשמח|מדוע|היכן|באמת כל כך|מהמם|מדהימ/i;

/**
 * Raw needy validation / direct fawning that breaks Tactician frame.
 * Tactician IS allowed observational/conditional compliments
 * ("יש בך משהו...", "וייב מסקרן", "נראה אם...") — those are NOT caught here.
 */
const WEAK_FLIRT_ALPHA_RE =
  /שמח ש|נחמד ש|איזה כיף|כיף לי|את מדהימ|את מהממ|יפה שלך|איזה יופי|מתוקה שלי(?! .*נראה| .*תוכיחי)|חמודה שלי|אוהב אותך|מתגעגע אלייך|בא לי אותך|אני צריך אותך|אני אוהב את|מתחנן/i;

const ROBOTIC_VALIDATION_ALPHA_RE =
  /^(כן|לא|ברור|בטח|כמובן|בוודאי)(\s|$)|^אוהב אותך$|^כן אוהב|שמח ש|נחמד ש/i;

const DOMESTIC_SITUATION_RE =
  /הכנת|בישלת|בישלתי|עשית בשביל|לעשות לי|הכנת לי|בישול|אוכל מוכן|ארוחה|לארוחה|תבשל|תכין לי|עשית לי|לנקות|כביסה/i;

const DOMESTIC_FLIP_RE = /הפוך|את האישה|את בבית|תבשל|תכיני|תתחילי|בבית קטנה|חסר לך שאין אוכל/i;

const ROBOTIC_DOMESTIC_ALPHA_RE =
  /^(כן|לא|ברור|בטח|כמובן|עשיתי|הכנתי|בישלתי|מוכן|כבר)|אשמח לבשל|בשמחה הכנתי/i;

function detectSituationKind(situation) {
  const s = String(situation);
  if (BREAKUP_SITUATION_RE.test(s)) return 'breakup';
  if (DOMESTIC_SITUATION_RE.test(s)) return 'domestic';
  if (/אוהב אותי|אוהבת אותי|מתגעגע|געגוע|חסר לי|געגעת לי/i.test(s)) return 'validation';
  if (/מוקדם|מספר|נשאר.*פה|נדבר פה/i.test(s)) return 'hesitation';
  if (/מעצבן|מעצבנת|מעצבן אותי/i.test(s)) return 'complaint';
  if (/חייב|תבוא|תגיע|תעשה לי|עכשיו אתה|מיד אתה/i.test(s)) return 'demand';
  if (/פנוי|פנויה|פנויות|ערב/i.test(s)) return 'green_light';
  if (/חושב.*(יכול|תצליח)/i.test(s)) return 'frame_test';
  if (/^חחח|רק חחח/i.test(s)) return 'dry_laugh';
  if (/איך היה|איך היום|מה איתך|מה קורה/i.test(s)) return 'small_talk';
  return 'general';
}

function pickFromStageList(map, stage) {
  const list = map[stage] || map.beginning;
  return list[Math.floor(Math.random() * list.length)];
}

function pickValidationFallback(stage) {
  return pickFromStageList(VALIDATION_BY_STAGE, stage);
}

function pickDomesticFallback(stage) {
  return pickFromStageList(DOMESTIC_BY_STAGE, stage);
}

function enforceAlphaRules(situation, responses, relationshipStage) {
  const kind = detectSituationKind(situation);
  const stage = normalizeRelationshipStage(relationshipStage);
  let alpha = trimAlphaWords(sanitizeResponseText(responses.alpha || ''));

  const wordCount = alpha.split(/\s+/).filter(Boolean).length;
  const tooLong = wordCount > ALPHA_MAX_WORDS;
  /**
   * Breakup cold-cuts are intentionally short ("סגור בהצלחה" = 2 words),
   * so we don't enforce the 3-word minimum on breakup.
   */
  const tooShort = kind !== 'breakup' && wordCount < ALPHA_MIN_WORDS;
  const hasPeriod = /\.\s*$/.test(String(responses.alpha || '').trim());
  const apologizes = /סורי|מצטער|מתנצל|סליחה/i.test(alpha);
  const weakFlirt = WEAK_FLIRT_ALPHA_RE.test(alpha);
  const heavyNickname = HEAVY_NICKNAME_RE.test(alpha);
  const stageBlocksNickname = (stage === 'beginning' || stage === 'middle') && heavyNickname;
  const roboticValidation =
    kind === 'validation' &&
    (ROBOTIC_VALIDATION_ALPHA_RE.test(alpha) || stageBlocksNickname);

  const weakDomestic =
    kind === 'domestic' &&
    (ROBOTIC_DOMESTIC_ALPHA_RE.test(alpha) ||
      !DOMESTIC_FLIP_RE.test(alpha) ||
      stageBlocksNickname);

  const weakBreakup =
    kind === 'breakup' &&
    (WEAK_BREAKUP_ALPHA_RE.test(alpha) || apologizes || heavyNickname);

  const fallbacks = {
    breakup:
      BREAKUP_ALPHA_FALLBACKS[
        Math.floor(Math.random() * BREAKUP_ALPHA_FALLBACKS.length)
      ],
    validation: pickValidationFallback(stage),
    domestic: pickDomesticFallback(stage),
    hesitation: 'פחות מקלדת, יאללה תרגיעי',
    complaint: 'תרגעי קצת, ננתח אחר כך',
    demand: 'לא ככה זה עובד פה',
    small_talk: 'יום עמוס, נדבר בערב',
    green_light: 'סגור, אוסף אותך בערב',
    frame_test: 'לא חושב, יודע — תבחני',
    dry_laugh: 'נחנקת שם או שיש לך משהו',
    general: 'יש בך משהו, נראה לאן זה הולך'
  };

  if (
    !alpha ||
    tooLong ||
    tooShort ||
    hasPeriod ||
    weakFlirt ||
    FORBIDDEN_ALPHA_RE.test(alpha) ||
    (apologizes && kind !== 'breakup') ||
    roboticValidation ||
    weakDomestic ||
    weakBreakup ||
    (stageBlocksNickname && kind !== 'breakup')
  ) {
    alpha = fallbacks[kind] || fallbacks.general;
  }

  responses.alpha = trimAlphaWords(alpha);
  return responses;
}

function responsesLookRobotic(responses) {
  const a = responses.alpha || '';
  const words = a.split(/\s+/).filter(Boolean).length;
  if (words > ALPHA_MAX_WORDS) return true;
  if (/\.$/.test(a.trim())) return true;
  if (FORBIDDEN_ALPHA_RE.test(a)) return true;
  if (WEAK_FLIRT_ALPHA_RE.test(a)) return true;
  if (ROBOTIC_VALIDATION_ALPHA_RE.test(a)) return true;
  if (/^היי יפה|מאמן|ארכיטיפ/i.test(a)) return true;
  return false;
}

function buildAlphaSimPrompt(userMessage, conversationContext) {
  return `Israeli dating simulator. Alpha = short, no period.

USER MESSAGE: "${userMessage.trim()}"
CONTEXT: ${conversationContext || 'opening'}

Return ONLY JSON:
{
  "isBeta": true|false,
  "analysis": "Hebrew breakdown or 'תגובה חזקה.'",
  "nextGirlReply": "natural Hebrew or \"\""
}`;
}

module.exports = {
  CHANNEL_CTX,
  STAGE_CTX,
  ALPHA_ARCHETYPE_BLOCK,
  ALPHA_MAX_WORDS,
  ALPHA_MIN_WORDS,
  ANALYZE_SYSTEM,
  normalizeRelationshipStage,
  buildAnalyzePrompt,
  buildAnalyzeMessages,
  sanitizeResponses,
  extractAnalyzePayload,
  normalizeScore,
  normalizeFeedback,
  enforceAlphaRules,
  detectSituationKind,
  responsesLookRobotic,
  buildAlphaSimPrompt,
  trimAlphaWords,
  stripTrailingPeriods
};
