/**
 * Shared UI helpers — copy icon + hint banners (global + ES module).
 */
export const COPY_ICON_SVG =
  '<svg class="copy-btn__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<rect x="8" y="2" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
  '<path d="M6 2h8a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="1.75"/>' +
  '</svg>';

export function wireCopyButton(btn, text) {
  if (!btn) return;
  btn.type = 'button';
  btn.className = 'copy-btn copy-btn--labeled';
  btn.innerHTML = '<span class="copy-btn__label">העתק</span>' + COPY_ICON_SVG;
  btn.setAttribute('aria-label', 'העתק ללוח');
  btn.setAttribute('title', 'העתק');
  btn.onclick = function () {
    const value = String(text || '');
    navigator.clipboard.writeText(value).then(
      function () {
        btn.classList.add('copied');
        setTimeout(function () {
          btn.classList.remove('copied');
          btn.blur();
        }, 1400);
      },
      function () {
        btn.classList.add('copy-btn--failed');
        setTimeout(function () {
          btn.classList.remove('copy-btn--failed');
        }, 1200);
      }
    );
  };
}

export function showUiHint(el, message) {
  if (!el) return;
  el.textContent = message || '';
  el.className = 'ui-hint-banner show';
}

export function showUiError(el, message) {
  if (!el) return;
  el.textContent = message || '';
  el.className = 'err-banner ui-hint-banner ui-hint-banner--error show';
}

export function hideUiMessage(el) {
  if (!el) return;
  el.classList.remove('show', 'ui-hint-banner', 'ui-hint-banner--error', 'err-banner');
  el.textContent = '';
}

if (typeof window !== 'undefined') {
  window.UI_HELPERS = {
    COPY_ICON_SVG,
    wireCopyButton,
    showUiHint,
    showUiError,
    hideUiMessage
  };
}
