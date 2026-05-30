/**
 * Dark Script API — entry point
 */
const { createApp } = require('./server/app');
const { PORT, logStartup } = require('./server/config/env');
const { CHAT_MODEL } = require('./server/simulation-engine');
const { GEMINI_MODEL } = require('./server/scenario-engine');

logStartup();
console.log(
  `✅ Routes: GET /health | POST /api/generate-script (${GEMINI_MODEL}) | /api/chat (${CHAT_MODEL}) | /api/feedback`
);

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 Dark Script API · port ${PORT}`);
});
