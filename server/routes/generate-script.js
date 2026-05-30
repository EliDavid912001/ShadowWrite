/**
 * POST /api/generate-script — 4 archetype answers via Gemini (server-side only).
 * API key lives in process.env.GEMINI_API_KEY — never exposed to the browser.
 */
const express = require('express');
const { runScenario, formatScenarioError } = require('../scenario-engine');

const router = express.Router();

async function handleGenerateScript(req, res) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'מפתח Gemini לא מוגדר בשרת — הוסף GEMINI_API_KEY ל-.env'
    });
  }

  const situation = String(
    req.body.situation ?? req.body.message ?? req.body.text ?? req.body.prompt ?? ''
  ).trim();

  if (!situation) {
    return res.status(400).json({ error: 'חסרה סיטואציה' });
  }

  const channel = ['app', 'whatsapp'].includes(req.body.channel) ? req.body.channel : 'app';
  const stage = req.body.stage ?? req.body.relationshipStage ?? 'start';
  const isVIP = req.body.isVIP === true || req.body.isVip === true;

  try {
    const responses = await runScenario(situation, channel, stage, { isVIP });
    res.json({
      success: true,
      responses,
      channel,
      stage
    });
  } catch (err) {
    console.error('[api/generate-script]', err.message);
    const errMsg = formatScenarioError(err);
    if (err.isRateLimit || err.response?.status === 429) {
      return res.status(429).json({ error: `מכסת Gemini — נסה שוב. (${errMsg})` });
    }
    if (/404|not found|לא זמין/i.test(errMsg)) {
      return res.status(502).json({ error: errMsg });
    }
    if (errMsg.includes('API key') || errMsg.includes('API_KEY') || err.response?.status === 401) {
      return res.status(401).json({ error: 'מפתח Gemini לא תקין' });
    }
    res.status(500).json({ error: `שגיאה ביצירת 4 התשובות: ${errMsg}` });
  }
}

router.post('/api/generate-script', handleGenerateScript);

/** Legacy alias */
router.post('/api/scenario', handleGenerateScript);

module.exports = { router, handleGenerateScript };
