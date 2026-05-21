# 🐺 The Dark Script — Backend Setup

## מה יש כאן
- `server.js` — השרת Node.js עם Gemini AI
- `public/index.html` — האפליקציה (הפרונטאנד)
- `package.json` — תלויות הפרויקט
- `.env.example` — דוגמה לקובץ הסודות

---

## התקנה מהירה

### 1. קח Gemini API Key (חינמי)
1. נכנס ל-https://aistudio.google.com
2. לוחץ **"Get API Key"**
3. מעתיק את ה-key

### 2. הגדרת הפרויקט
```bash
npm install
cp .env.example .env
```
פותח את `.env` ומכניס את ה-key:
```
GEMINI_API_KEY=ה-key-שלך-כאן
```

### 3. הרצה מקומית
```bash
npm run dev
```
פותח בדפדפן: http://localhost:3000

---

## העלאה ל-Render (חינמי)

1. דחוף את הקוד ל-GitHub
2. נכנס ל-https://render.com
3. לוחץ **"New Web Service"** → מחבר את ה-GitHub repo
4. הגדרות:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. ב-**Environment Variables** מוסיף: `GEMINI_API_KEY=ה-key-שלך`
6. לוחץ Deploy — תוך 2 דקות יש לך URL חי

## העלאה ל-Vercel

```bash
npm install -g vercel
vercel
```
ב-Vercel Dashboard מוסיפים את `GEMINI_API_KEY` ב-Environment Variables.

---

## מבנה הפרויקט
```
dark-script/
├── server.js          ← השרת
├── package.json
├── .env               ← סודות (לא לעלות ל-GitHub!)
├── .gitignore
└── public/
    └── index.html     ← האפליקציה
```
