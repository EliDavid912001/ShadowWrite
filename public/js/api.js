/**
 * API client — Render in production, same-origin locally.
 * Retries silently on cold-start / network failures (no user-facing wait message).
 */
function apiUrl(path) {
  if (typeof path === 'string' && /^https?:\/\//i.test(path)) return path;
  if (typeof window !== 'undefined' && window.API_CONFIG?.apiUrl) {
    return window.API_CONFIG.apiUrl(path);
  }
  return path;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableFetchError(err) {
  if (!err) return false;
  if (err.name === 'TypeError') return true;
  const msg = String(err.message || '').toLowerCase();
  return /network|failed to fetch|load failed|fetch/i.test(msg);
}

export { apiUrl };

/**
 * POST JSON with retry (up to 3 attempts, 2s between).
 */
export async function postJson(path, body, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { error: 'תשובה לא תקינה מהשרת' };
      }

      if (!res.ok) {
        const err = new Error(data.error || `שגיאת שרת (${res.status})`);
        if (attempt < maxAttempts && isRetryableHttpStatus(res.status)) {
          console.warn(`[api] HTTP ${res.status} — retry ${attempt}/${maxAttempts} in ${retryDelayMs}ms`);
          await sleep(retryDelayMs);
          continue;
        }
        throw err;
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isRetryableFetchError(err)) {
        console.warn(`[api] fetch failed — retry ${attempt}/${maxAttempts} in ${retryDelayMs}ms`, err.message);
        await sleep(retryDelayMs);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('בקשה נכשלה');
}
