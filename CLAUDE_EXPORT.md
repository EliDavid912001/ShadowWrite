# The Dark Script VIP — ייצוא מלא ל-Claude

> העתק את הקובץ הזה כולו ל-Claude (או צרף אותו) ובקש: "שפר את האפליקציה — UI/UX פרימיום, תקן באגים, הרחב דאטה, שמור על ארכיטיפים קשיחים."

---

## 1. תקציר הפרויקט

**שם:** The Dark Script VIP  
**סוג:** אפליקציית ווב mobile-first לייעוץ דייטינג בעברית (RTL)  
**סטאק:** Node.js + Express + Groq API (Llama 3.3 70B) | Frontend: HTML + CSS + JS bundle (ללא React)  
**הרצה:** `npm run dev` → http://localhost:3000 (לא לפתוח index.html ישירות)

### פיצ'רים (4 טאבים)
| טאב | תיאור |
|-----|--------|
| **תשובות** | מנוע 4 ארכיטיפים (Alpha/Beta/Witty/Friendly) + סיטואציות offline + AI דרך `/api/analyze` |
| **אמת/חובה** | בקבוק 3D CSS + פרומפטים פסיכולוגיים |
| **אלפא** | סימולטור צ'אט — תגובת בטא = BUG DETECTED + `/api/alpha-sim` |
| **VIP** | 3 מדריכי masterclass באקורדיון |

### Design System
- רקע: `#0B0B0F` (Obsidian)
- כרטיסים: `#16161E` (Carbon)
- אקשן: `#FF2A54` (Crimson)
- VIP: `#FFB800` (Gold)
- טקסט: `#F4F4F8`
- וייב: dark luxury, gaming dashboard, mobile-first

### ארכיטיפים (חובה — לא לרכך!)
- **ALPHA:** ערס — קצר, ביטחון שקט+חוצפה ("יודע/ברור/סוף"), עברית טבעית, **בלי אימוג'ים**, בלי התנצלות, low-investment
- **BETA:** רך, מתנצל, people-pleasing, מחפש אישור
- **WITTY:** עוקץ, מצחיק, מתח דרך הומור
- **FRIENDLY:** חם, ישיר, אמפתי בלי supplication

### API
- `POST /api/analyze` — body: `{ situation, channel }` → `{ responses: { alpha, beta, witty, friendly } }`
- `POST /api/alpha-sim` — body: `{ message, context }` → `{ isBeta, errorHe, reframeHint }`
- `GET /api/health`
- `.env`: `GROQ_API_KEY=...`

### מבנה קבצים
```
my-matrix-app/
├── server.js
├── package.json
├── .env                    # GROQ_API_KEY (לא לשלוח!)
├── server/
│   ├── prompts/archetypes.js
│   └── routes/api.js
└── public/
    ├── index.html          # ← נקודת כניסה
    ├── app.bundle.js       # ← כל ה-frontend (פעיל)
    ├── css/styles.css
    └── js/                 # מודולים (גרסה ישנה, לא בשימוש ב-index)
```

### בעיות ידועות לתיקון
1. האפליקציה לא עבדה עם ES modules + CDN — עבר ל-`app.bundle.js`
2. דאטת סיטואציות מקוצרת (3 במקום ~20 במקור)
3. מדריכי VIP מקוצרים ב-bundle לעומת `vip-guides.js`
4. אין Three.js — רק CSS 3D לבקבוק

---

## 2. package.json

```json
{
  "name": "dark-script-api",
  "version": "1.0.0",
  "description": "The Dark Script - Dating AI Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@google/generative-ai": "^0.21.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": { "node": ">=18.0.0" }
}
```

---

## 3. server.js

```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./server/routes/api');

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  })
);

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐺 The Dark Script VIP server running on port ${PORT}`);
});
```

---

## 4. server/prompts/archetypes.js

(ראה קובץ מלא בפרויקט — מכיל `buildAnalyzePrompt` ו-`buildAlphaSimPrompt` עם כללי ארכיטיפ קשיחים)

---

## 5. server/routes/api.js

Groq endpoint: `https://api.groq.com/openai/v1/chat/completions`  
Model: `llama-3.3-70b-versatile`

---

## 6. DATA — אמת/חובה (מלא)

### TRUTH_PROMPTS
```javascript
[
  'ספרי על הפעם האחרונה שחשבת על מישהו אחרת בזמן דייט — בלי לייפות.',
  'מה הדבר הכי פחדני שאת מסתירה מאנשים שמושכים אותך?',
  'אם היינו לבד עכשיו — מה היית עושה קודם: מדברת או נוגעת?',
  'דרגי את עצמך 1-10 — כמה את באמת פתוחה לסכנה רגשית הערב?',
  'מה המשפט שגבר אמר לך ועדיין חוזר לך בראש?',
  'איזה חלק בגוף שלך את הכי גאה בו — ואיזה את מסתירה?',
  'מתי בפעם האחרונה הרגשת מתאהבת מהר מדי — ומה עשית עם זה?',
  'מה הייתה הפנטזיה הכי מופרעת שלך השנה — רק כותרת, בלי פרטים מיותרים.'
]
```

### DARE_PROMPTS
```javascript
[
  'שמרי קשר עין 10 שניות — בלי לצחוק, בלי להסביר למה.',
  'לחשי באוזן משהו שאמרת רק לעצמך — לא לי, לעצמך.',
  'תני לי שאלה שאת מפחדת לשאול אותי — עכשיו.',
  'שלחי לי עכשיו אימוג׳י אחד שמתאר איך את מרגישה כרגע — בלי מילים.',
  'תארי איך היית רוצה שיגעו בך — במשפט אחד, ישיר.',
  'הימנעי מ"כן/לא" ל-30 שניות — ענה רק במשפטים.',
  'תני לי ניחוש אחד על מה שאני חושב עלייך — אם טעית, את שואלת.',
  'הציעי פעילות ל-20 דקות שתעלה את המתח — בלי "נלך לקפה".'
]
```

---

## 7. DATA — סיטואציות offline (גרסה מודולרית)

```javascript
// public/js/data/situations.js — 5 סיטואציות + QUICK_TAGS + PERSONA_INFO
// ב-app.bundle.js רק 3 סיטואציות — צריך להרחיב ל-20+ כמו המקור
```

### QUICK_TAGS
`['חחח', 'גוסטינג', 'יש לה חבר', 'מוקדם מדי', 'דייט', 'ריד סיין']`

### PERSONA_INFO
```javascript
{
  alpha: { label: 'אלפא', sub: 'רגוע · קצר · בלי הסברים' },
  beta: { label: 'בטא', sub: 'רך · מתנצל · מרצה' },
  witty: { label: 'שנון', sub: 'עוקץ · משחק מסגרת' },
  friendly: { label: 'חברי', sub: 'חם · ישיר · בלי לחץ' }
}
```

### SITUATIONS_DATA (5 entries)
ראה `public/js/data/situations.js` בפרויקט.

---

## 8. DATA — מדריכי VIP (מלא)

### 1. מדריך לבתול
- שבירת חרדה: נוכחות, שאלה+שתיקה, לא "מה היא חושבת"
- בלי פדסטל: היא בן אדם, משיכה=גבולות, אל תוכיח

### 2. להחזיר את הסקס לחיי הנישואין
- Intermittent Reward, ערבים לא צפויים
- קוטביות: מרחב לחידוש, פנטזיה בלי לחץ

### 3. איך לא לגמור מהר
- Edging, Reverse Kegels, נשימת 4-7-8
- חרדת ביצועים: חוויה לא ציון, הומור אם קרה מהר

(טקסט מלא ב-`public/js/modules/vip-guides.js`)

---

## 9. פרומפט ל-Claude (העתק לתחילת השיחה)

```
אתה Senior Full-Stack + UI/UX. יש לך את כל קוד The Dark Script VIP.

מטרות:
1. תקן שהאפליקציה עובדת 100% ב-mobile (http://localhost:3000)
2. שדרג UI ל-VIP dark luxury (#0B0B0F, #FF2A54, #FFB800)
3. הרחב SITUATIONS_DATA ל-20+ סיטואציות בעברית
4. שמור ארכיטיפים קשיחים בפרומפט — אלפא בלי אימוג'ים/התנצלות
5. שפר בקבוק 3D (CSS או Three.js)
6. Alpha Sim — גליצ' BUG DETECTED חזק יותר
7. קוד מודולרי ונקי — אפשר לפצל מ-app.bundle.js

אל תשנה: Groq API, מבנה 4 ארכיטיפים, RTL עברית.
החזר: קבצים מלאים מעודכנים + הוראות הרצה.
```

---

## 10. קבצי קוד — נתיבים בפרויקט

העתק ידנית מהתיקייה או פתח ב-Cursor:

| קובץ | שורות | תפקיד |
|------|-------|--------|
| `public/index.html` | 70 | Shell + nav |
| `public/app.bundle.js` | 369 | **כל ה-frontend הפעיל** |
| `public/css/styles.css` | 1017 | Design system |
| `server/prompts/archetypes.js` | 94 | AI prompts |
| `server/routes/api.js` | 109 | API routes |
| `public/js/data/situations.js` | 82 | Situations data |
| `public/js/data/truth-dare-prompts.js` | 22 | T/D prompts |
| `public/js/modules/vip-guides.js` | 125 | VIP guides full |

---

## 11. index.html (מלא)

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0B0B0F">
  <title>The Dark Script · VIP</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+Hebrew:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div id="boot-error" class="boot-error hidden" role="alert"></div>
  <div class="noise-overlay" aria-hidden="true"></div>
  <div class="app-shell">
    <header class="top-bar">
      <div class="brand-mini">DARK <span>SCRIPT</span></div>
      <span class="vip-pill">👑 VIP</span>
    </header>
    <main>
      <section id="view-analyze" class="view"><div id="mount-analyze"></div></section>
      <section id="view-truth" class="view active">
        <div class="section-eyebrow">Truth or Dare</div>
        <h2 class="section-title">אמת או חובה</h2>
        <p class="section-desc">סובב את הבקבוק — קבל מתח לדייט.</p>
        <div id="mount-truth"></div>
      </section>
      <section id="view-sim" class="view"><div id="mount-sim"></div></section>
      <section id="view-vip" class="view"><div id="mount-vip"></div></section>
    </main>
    <nav class="bottom-nav">
      <button type="button" class="nav-btn" data-view="analyze"><span class="nav-icon">💬</span><span>תשובות</span></button>
      <button type="button" class="nav-btn active" data-view="truth"><span class="nav-icon">🍾</span><span>אמת/חובה</span></button>
      <button type="button" class="nav-btn" data-view="sim"><span class="nav-icon">🐛</span><span>אלפא</span></button>
      <button type="button" class="nav-btn vip-tab" data-view="vip"><span class="nav-icon">📖</span><span>VIP</span></button>
    </nav>
  </div>
  <script src="/app.bundle.js" defer></script>
</body>
</html>
```

---

## 12. הערה חשובה

**`public/app.bundle.js`** (369 שורות) ו-**`public/css/styles.css`** (1017 שורות) — הקבצים הגדולים ביותר.

לייצוא מלא עם כל השורות: ב-Cursor פתח את:
- `c:\Users\elida\Downloads\my-matrix-app\public\app.bundle.js`
- `c:\Users\elida\Downloads\my-matrix-app\public\css\styles.css`
- `c:\Users\elida\Downloads\my-matrix-app\server\prompts\archetypes.js`
- `c:\Users\elida\Downloads\my-matrix-app\server\routes\api.js`

או צרף את כל תיקיית `my-matrix-app` ל-Claude (Projects) בלי `.env` ו-`node_modules`.

---

*נוצר אוטומטית — The Dark Script VIP Export*
