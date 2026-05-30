/**
 * Express application factory — middleware + routes.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

const { staticMiddleware, PUBLIC_DIR } = require('./middleware/static');
const healthRoutes = require('./routes/health');
const generateScriptRoutes = require('./routes/generate-script').router;
const apiRoutes = require('./routes/api-routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  app.use(staticMiddleware());

  app.use(healthRoutes);
  app.use(generateScriptRoutes);
  app.use(apiRoutes);

  app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

module.exports = { createApp };
