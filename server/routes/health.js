const express = require('express');
const { GEMINI_API_KEY, GROQ_API_KEY } = require('../config/env');

const router = express.Router();

/** Primary health check */
router.get('/health', (req, res) => {
  res.json({ status: 'Server is alive and breathing' });
});

/** API namespace health (backwards compatible) */
router.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is alive and breathing',
    gemini: Boolean(GEMINI_API_KEY),
    groq: Boolean(GROQ_API_KEY)
  });
});

module.exports = router;
