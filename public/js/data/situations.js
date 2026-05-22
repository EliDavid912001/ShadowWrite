export const SITUATIONS_DATA = [
  {
    id: 'wa_free_tonight',
    ch: ['app', 'whatsapp'],
    icon: '✨',
    cat: 'וואטסאפ',
    title: 'אמרה שהיא פנויה הערב',
    keywords: ['פנויה', 'פנוי', 'פנויות', 'פנוי הערב'],
    responses: {
      alpha: { text: 'שומעת. תתארגני ל-21:00. אוסף אותך לדרינק.' },
      beta: { text: 'איזה כיף! מה בא לך לעשות? אני פנוי מתי שתרצי 😅' },
      witty: { text: 'תלוי איך התנהגת השבוע. אולי דרינק. נראה.' },
      friendly: { text: 'אש. בואי בירה בערב — יאללה.' }
    }
  },
  {
    id: 'app_hahaha',
    ch: ['app'],
    icon: '💬',
    cat: 'אפליקציית היכרויות',
    title: 'חזר רק חחח',
    keywords: ['חחח', 'hahaha', 'lol'],
    responses: {
      alpha: { text: 'חחח זה לא תשובה. דברי.' },
      beta: { text: 'חחח אהבתי 😄 מה שלומך?' },
      witty: { text: 'נגמרו המילים? אני יכול לשאיל.' },
      friendly: { text: 'חחח אוקיי. מה קורה אצלך היום?' }
    }
  },
  {
    id: 'wa_ghosting',
    ch: ['whatsapp', 'app'],
    icon: '👻',
    cat: 'וואטסאפ',
    title: 'גוסטינג',
    keywords: ['גוסטינג', 'ghosting', 'נעלמה'],
    responses: {
      alpha: { text: 'ברור. כשתרצי — את יודעת איפה למצוא אותי.' },
      beta: { text: 'היי, הכל בסדר? לא שמעתי ממך כמה ימים.' },
      witty: { text: 'בדקתי — ה-Wi-Fi שלי עובד. אז כנראה זה לא הכיוון.' },
      friendly: { text: 'היי, נראה שפיספסנו. בלי לחץ — אם תרצי לדבר, אני פה.' }
    }
  },
  {
    id: 'app_tooearly_meet',
    ch: ['app', 'whatsapp'],
    icon: '⏰',
    cat: 'דייטים',
    title: 'מוקדם מדי לפגוש',
    keywords: ['מוקדם', 'לפגוש'],
    responses: {
      alpha: { text: 'פחות מקלדת יאללה' },
      beta: { text: 'כמובן, אני מבין אותך לגמרי. ניכר בקצב שנוח לך.' },
      witty: { text: 'טוב שאמרת — כי גם אני עוד לא החלטתי אם אני רוצה.' },
      friendly: { text: 'לגמרי מכבד את זה. נכיר קצת יותר קודם.' }
    }
  },
  {
    id: 'phone_boyfriend',
    ch: ['app', 'whatsapp'],
    icon: '💔',
    cat: 'שיחת טלפון',
    title: 'אמרה שיש לה חבר',
    keywords: ['חבר', 'boyfriend'],
    responses: {
      alpha: { text: 'שאלתי אם תרצי לשתות קפה, לא אם את פנויה.' },
      beta: { text: 'ממש מכבד את זה. תמיד כיף לדבר.' },
      witty: { text: 'הוא מוזמן. אני אשלם על שלושה שוורמות.' },
      friendly: { text: 'מעריך שאמרת. נדבר כחברים?' }
    }
  },
  {
    id: 'ip_end_date',
    ch: ['app', 'whatsapp'],
    icon: '🌙',
    cat: 'פנים מול פנים',
    title: 'סיום דייט מוצלח',
    keywords: ['סיום', 'לפני שהולכת'],
    responses: {
      alpha: { text: 'היה כיף. סוף. נדבר.' },
      beta: { text: 'היה ממש נחמד! אשמח לעשות את זה שוב 😊' },
      witty: { text: 'אוקיי, הצלחת לגרום לי לרצות דייט שני.' },
      friendly: { text: 'נהניתי מאוד. נדבר מחר?' }
    }
  }
];

export const QUICK_TAGS = ['פנויה', 'חחח', 'גוסטינג', 'מוקדם מדי', 'דייט'];

export const PERSONA_INFO = {
  alpha: { label: '🐺 אלפא', sub: 'push-pull · 2-7 מילים' },
  beta: { label: 'בטא', sub: 'רך · מתנצל · מרצה' },
  witty: { label: 'שנון', sub: 'עוקץ · משחק מסגרת' },
  friendly: { label: 'חברי', sub: 'חם · ישיר · בלי לחץ' }
};
