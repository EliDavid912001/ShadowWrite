import { TRUTH_PROMPTS, DARE_PROMPTS } from '../data/truth-dare-prompts.js';

/** Bridge for ES module app — delegates to shared game script when loaded */
export class TruthOrDareGame {
  constructor(rootEl) {
    this.root = rootEl;
    if (window.initTruthOrDare) {
      window.TOD_DECKS = window.TOD_DECKS || { truths: TRUTH_PROMPTS, dares: DARE_PROMPTS };
      window.initTruthOrDare(rootEl);
      return;
    }
    this.root.innerHTML =
      '<p class="tod-error">טען truth-or-dare-game.js ו-truth-dare-decks.js</p>';
  }

  destroy() {}
}
