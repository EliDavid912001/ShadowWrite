import { TRUTH_PROMPTS, DARE_PROMPTS } from '../data/truth-dare-prompts.js';

/**
 * 3D Bottle Spinner — CSS 3D + rAF physics (mobile-optimized)
 */
export class TruthOrDareGame {
  constructor(rootEl) {
    this.root = rootEl;
    this.mode = 'random'; // random | truth | dare
    this.spinning = false;
    this.rotationY = 0;
    this.angularVelocity = 0;
    this.rafId = null;

    this.render();
    this.bind();
    if (window.lucide) window.lucide.createIcons();
  }

  render() {
    this.root.innerHTML = `
      <div class="tod-mode-toggle">
        <button type="button" class="mode-chip active" data-mode="random">🎲 אקראי</button>
        <button type="button" class="mode-chip truth-mode" data-mode="truth">אמת</button>
        <button type="button" class="mode-chip dare-mode" data-mode="dare">חובה</button>
      </div>
      <div class="card card-pad tod-arena">
        <div class="tod-scene" aria-hidden="true">
          <div class="tod-spinner" id="todSpinner">
            <div class="tod-ring" id="todRing">
              <div class="tod-label truth">אמת</div>
              <div class="tod-label dare">חובה</div>
            </div>
            <div class="bottle-group" id="todBottle">
              <div class="bottle-body">
                <div class="bottle-cork"></div>
                <div class="bottle-neck"></div>
                <div class="bottle-glass"></div>
              </div>
            </div>
            <div class="tod-floor"></div>
          </div>
        </div>
        <button type="button" class="btn-primary" id="todSpinBtn">
          <i data-lucide="rotate-cw"></i>
          סובב את הבקבוק
        </button>
        <div class="tod-result" id="todResult">
          <div class="tod-result-card" id="todResultCard">
            <div class="tod-result-type" id="todResultType"></div>
            <p class="tod-result-text" id="todResultText"></p>
          </div>
        </div>
      </div>`;
  }

  bind() {
    this.spinner = this.root.querySelector('#todSpinner');
    this.ring = this.root.querySelector('#todRing');
    this.bottle = this.root.querySelector('#todBottle');
    this.spinBtn = this.root.querySelector('#todSpinBtn');
    this.resultEl = this.root.querySelector('#todResult');
    this.resultCard = this.root.querySelector('#todResultCard');
    this.resultType = this.root.querySelector('#todResultType');
    this.resultText = this.root.querySelector('#todResultText');

    this.spinBtn.addEventListener('click', () => this.spin());

    this.root.querySelectorAll('.mode-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (this.spinning) return;
        this.root.querySelectorAll('.mode-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.mode = chip.dataset.mode;
      });
    });

    this.applyRotation(0);
  }

  applyRotation(deg) {
    this.rotationY = deg;
    this.spinner.style.transform = `rotateY(${deg}deg)`;
    this.bottle.style.transform = `rotateY(${deg * 0.6}deg)`;
  }

  pickOutcome() {
    if (this.mode === 'truth') return 'truth';
    if (this.mode === 'dare') return 'dare';
    return Math.random() < 0.5 ? 'truth' : 'dare';
  }

  spin() {
    if (this.spinning) return;

    this.spinning = true;
    this.spinBtn.disabled = true;
    this.resultEl.classList.remove('reveal');

    const outcome = this.pickOutcome();
    const extraTurns = 4 + Math.floor(Math.random() * 3);
    const targetOffset = outcome === 'truth' ? 0 : 180;
    const current = ((this.rotationY % 360) + 360) % 360;
    let delta = targetOffset - current;
    if (delta < 0) delta += 360;
    const finalRotation = this.rotationY + extraTurns * 360 + delta + (Math.random() * 24 - 12);

    const startRot = this.rotationY;
    const duration = 2800 + Math.random() * 800;
    const startTime = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3.2);
      const rot = startRot + (finalRotation - startRot) * eased;
      this.applyRotation(rot);

      if (t < 1) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.spinning = false;
        this.spinBtn.disabled = false;
        this.showResult(outcome);
        if (window.lucide) window.lucide.createIcons();
      }
    };

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(tick);
  }

  showResult(type) {
    const pool = type === 'truth' ? TRUTH_PROMPTS : DARE_PROMPTS;
    const prompt = pool[Math.floor(Math.random() * pool.length)];

    this.resultCard.className = `tod-result-card ${type}-type`;
    this.resultType.textContent = type === 'truth' ? '⚡ אמת — מתח פסיכולוגי' : '🔥 חובה — voltage גבוה';
    this.resultText.textContent = prompt;

    requestAnimationFrame(() => {
      this.resultEl.classList.add('reveal');
      this.resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
