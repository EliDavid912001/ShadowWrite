const GUIDES = [
  {
    id: 'beginner',
    icon: 'compass',
    title: 'מדריך לבתול',
    sub: 'ביטחון, חרדה חברתית, ערך עצמי',
    sections: [
      {
        h: 'שבירת חרדה — לא "טכניקות"',
        items: [
          'המטרה היא לא להיות מושלם — אלא להיות נוכח. 30 שניות של קשר עין + חיוך קל עושים יותר מ-100 שורות בצ\'אט.',
          'תרגל "שאלה אחת + שתיקה". אל תמלא שתיקות — ביטחון נשמע בשקט.',
          'הפסק לחשוב "מה היא חושבת עלי" — זה מוריד אותך מכסא האלפא.'
        ]
      },
      {
        h: 'מפסיקים לשים אותה על פדסטל',
        items: [
          'היא בן אדם עם חרדות משלה — לא פרס.',
          'משיכה = עניין + גבולות. לא התנצלות על קיום.',
          'אם אתה מרגיש צורך "להוכיח" — עצור. חזור לשאלה: מה אני רוצה מהערב הזה?'
        ]
      }
    ]
  },
  {
    id: 'marriage',
    icon: 'flame',
    title: 'להחזיר את הסקס לחיי הנישואין',
    sub: 'פרסים לסירוגין, קוטביות, שבירת שגרה',
    sections: [
      {
        h: 'מערכת תגמול לסירוגין (Intermittent Reward)',
        items: [
          'עקביות מוחלטת הורגת מתח — לא רק בילדים, גם בזוגיות.',
          'תכנן "ערבים שלא צפויים" — לא תאריך קבוע, לא אותו מסעדה.',
          'הפתעה ≠ כסף. שינוי אנרגיה, הומור, מסגרת חדשה.'
        ]
      },
      {
        h: 'קוטביות מינית בטווח ארוך',
        items: [
          'אם אתם שותפים בכל — אתם לא מאהבים. השאר מרחב לחידוש.',
          'דברו על פנטזיה בלי לחץ לביצוע מיידי.',
          'גוף + נוכחות > ביצועים. הפחת "ביצועים" מהשיחה.'
        ]
      }
    ]
  },
  {
    id: 'stamina',
    icon: 'zap',
    title: 'איך לא לגמור מהר',
    sub: 'Edging, קגל הפוך, מסגור קוגניטיבי',
    sections: [
      {
        h: 'טכניקות פיזיות',
        items: [
          'Edging: התקרב ל-7/10, עצור 20 שניות, חזור — 3-4 מחזורים לפני שחרור.',
          'Reverse Kegels: נשיפה ארוכה + "לשחרר" את רצפת האגן — לא לדחוס.',
          'נשימת 4-7-8: שאף 4, החזק 7, נשוף 8 — לפני ותוך כדי.'
        ]
      },
      {
        h: 'חרדת ביצועים — המסגור',
        items: [
          'המוח מחפש "הוכחה" — זה ממהיר גמר. המטרה: חוויה, לא ציון.',
          'אם קורה מהר — אל תתנצל. הומור קל + מעבר לקשר עין.',
          'שיחה עם השותפה על לחץ = מוריד 50% מהמתח.'
        ]
      }
    ]
  }
];

export function initVipGuides(container) {
  container.innerHTML = `
    <div class="section-eyebrow">VIP Masterclass</div>
    <h2 class="section-title">מדריכי פרימיום</h2>
    <p class="section-desc">תוכן עומק — פתח כרטיס, קרא, יישם. ללא רעש.</p>
    <div class="guide-list" id="guideList"></div>`;

  const list = container.querySelector('#guideList');

  list.innerHTML = GUIDES.map(
    (g) => `
    <article class="guide-item" data-guide="${g.id}">
      <button type="button" class="guide-trigger" aria-expanded="false">
        <div class="guide-icon-wrap"><i data-lucide="${g.icon}"></i></div>
        <div class="guide-meta">
          <div class="guide-title">${g.title}</div>
          <div class="guide-sub">${g.sub}</div>
        </div>
        <i data-lucide="chevron-down" class="guide-chev"></i>
      </button>
      <div class="guide-panel">
        <div class="guide-content">
          ${g.sections
            .map(
              (s) => `
            <h4>${s.h}</h4>
            <ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`
            )
            .join('')}
        </div>
      </div>
    </article>`
  ).join('');

  list.querySelectorAll('.guide-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.guide-item');
      const wasOpen = item.classList.contains('open');
      list.querySelectorAll('.guide-item').forEach((el) => {
        el.classList.remove('open');
        el.querySelector('.guide-trigger')?.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}
