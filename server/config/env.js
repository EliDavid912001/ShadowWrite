/**
 * Environment configuration — load once at process start.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim() || '';

function logStartup() {
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is missing — add it to .env');
  } else {
    console.log(`✅ Gemini key loaded: ${GEMINI_API_KEY.slice(0, 7)}...`);
  }

  if (!GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY missing (optional — alpha-sim only)');
  } else {
    console.log(`✅ Groq key loaded: ${GROQ_API_KEY.slice(0, 7)}...`);
  }
}

module.exports = {
  PORT,
  GEMINI_API_KEY,
  GROQ_API_KEY,
  logStartup
};
