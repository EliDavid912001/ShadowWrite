/**
 * API base URL — local dev uses same-origin; production calls Render backend.
 */
(function (global) {
  const PRODUCTION_API_BASE = 'https://shadowwrite.onrender.com';

  function isLocalDev() {
    const host = global.location?.hostname || '';
    return host === 'localhost' || host === '127.0.0.1';
  }

  function getApiBase() {
    return isLocalDev() ? '' : PRODUCTION_API_BASE;
  }

  /** @param {string} path e.g. "/api/generate-script" */
  function apiUrl(path) {
    const normalized = String(path || '').startsWith('/') ? String(path) : `/${path}`;
    const base = getApiBase().replace(/\/$/, '');
    return base ? `${base}${normalized}` : normalized;
  }

  global.API_CONFIG = {
    PRODUCTION_API_BASE,
    isLocalDev,
    getApiBase,
    apiUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
