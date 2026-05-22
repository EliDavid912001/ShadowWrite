/**
 * Dating-psychology loaders (classic script — no ES modules)
 */
(function (global) {
  'use strict';

  var LOADING_PHRASES = [
    '🧠 מנתח דינמיקה חברתית...',
    '🐺 מחשב מדדי אלפא...',
    '🕵️‍♂️ מפענח טקסטים נסתרים...',
    '🔥 מזקק עקיצות מדויקות...',
    '🎯 בונה אסטרטגיית חדירה לשריון...'
  ];

  var BUTTON_LOADING_PHRASES = [
    '🧠 מנתח דינמיקה...',
    '🐺 מחשב מדדי אלפא...',
    '🕵️‍♂️ מפענח שפת גוף...',
    '🔥 מזקק עקיצות...'
  ];

  var COACH_PHRASES = [
    '🧠 סורק מסגרת ודינמיקת כוח...',
    '🐺 מודד רמת אלפא מול בטא...',
    '🕵️‍♂️ מפענח דפוסי התנהגות...',
    '🔥 מזקק משוב חד לפעם הבאה...',
    '🎯 בונה תוכנית שדרוג לדייטים...'
  ];

  var PSYCH_LOADER_MARKUP =
    '<div class="psych-scan-loader" role="status" aria-live="polite">' +
    '<div class="psych-scan-radar" aria-hidden="true"></div>' +
    '<p class="psych-scan-text"></p></div>';

  function startButtonPsychLoader(btn, options) {
    if (!btn) return null;
    stopButtonPsychLoader(btn);

    var phrases = (options && options.phrases) || BUTTON_LOADING_PHRASES;
    var intervalMs = (options && options.intervalMs) || 1000;
    var originalText = btn.textContent;

    btn.classList.add('loading-pulse');
    btn.disabled = true;
    var idx = 0;
    btn.textContent = phrases[0];

    var timerId = setInterval(function () {
      idx = (idx + 1) % phrases.length;
      btn.textContent = phrases[idx];
    }, intervalMs);

    btn._btnPsychOriginalText = originalText;
    btn._btnPsychIntervalId = timerId;
    return timerId;
  }

  function stopButtonPsychLoader(btn) {
    if (!btn) return;
    if (btn._btnPsychIntervalId) {
      clearInterval(btn._btnPsychIntervalId);
      btn._btnPsychIntervalId = null;
    }
    btn.classList.remove('loading-pulse');
    btn.disabled = false;
    btn.textContent = btn._btnPsychOriginalText || '⚡ קבל 4 ארכיטיפים';
    btn._btnPsychOriginalText = null;
  }

  function startPsychLoader(hostEl, options) {
    if (!hostEl) return null;
    stopPsychLoader(hostEl);

    var phrases =
      (options && options.phrases) ||
      (options && options.mode === 'coach' ? COACH_PHRASES : LOADING_PHRASES);
    var intervalMs = (options && options.intervalMs) || 1200;

    hostEl.classList.remove('hidden');
    hostEl.innerHTML = PSYCH_LOADER_MARKUP;
    hostEl.setAttribute('aria-busy', 'true');

    var textEl = hostEl.querySelector('.psych-scan-text');
    var idx = 0;

    function tick() {
      if (textEl) textEl.textContent = phrases[idx % phrases.length];
      idx += 1;
    }

    tick();
    var timerId = setInterval(tick, intervalMs);
    hostEl._psychIntervalId = timerId;
    return timerId;
  }

  function stopPsychLoader(hostEl) {
    if (!hostEl) return;
    if (hostEl._psychIntervalId) {
      clearInterval(hostEl._psychIntervalId);
      hostEl._psychIntervalId = null;
    }
    hostEl.removeAttribute('aria-busy');
    hostEl.classList.add('hidden');
    hostEl.innerHTML = '';
  }

  global.PSYCH_LOADER = {
    LOADING_PHRASES: LOADING_PHRASES,
    COACH_PHRASES: COACH_PHRASES,
    BUTTON_LOADING_PHRASES: BUTTON_LOADING_PHRASES,
    start: startPsychLoader,
    stop: stopPsychLoader,
    startButton: startButtonPsychLoader,
    stopButton: stopButtonPsychLoader
  };
})(typeof window !== 'undefined' ? window : global);
