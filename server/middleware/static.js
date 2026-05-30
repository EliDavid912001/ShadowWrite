const express = require('express');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function staticMiddleware() {
  return express.static(PUBLIC_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
      }
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    }
  });
}

module.exports = { staticMiddleware, PUBLIC_DIR };
