/**
 * UI lock during session scoring — analysis API runs ONLY from
 * «סיים וקבל ציון» (requestSessionAnalysis). Chat uses POST /api/chat plain text only.
 */
export let isAnalyzing = false;

export function setAnalyzing(value) {
  isAnalyzing = Boolean(value);
  if (typeof window !== 'undefined') {
    window.isAnalyzing = isAnalyzing;
    document.body.classList.toggle('coach-modal-open', isAnalyzing);
    if (!isAnalyzing) {
      document.body.classList.remove('modal-blur');
    }
  }
}

export function assertChatMode() {
  if (isAnalyzing) {
    throw new Error('Chat blocked while analysis is active');
  }
}
