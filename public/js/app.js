import { initFourAnswers } from './modules/four-answers.js';
import { initAnalyze } from './modules/analyze.js';
import { TruthOrDareGame } from './modules/truth-or-dare.js';
import { initVipGuides } from './modules/vip-guides.js';
import { setAnalyzing } from './simulator-state.js';

const VIEWS = ['analyze', 'truth', 'sim', 'vip'];

let truthGame = null;

function switchView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  const view = document.getElementById(`view-${id}`);
  const nav = document.querySelector(`.nav-btn[data-view="${id}"]`);
  if (view) view.classList.add('active');
  if (nav) nav.classList.add('active');

  if (window.lucide) window.lucide.createIcons();
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      if (!VIEWS.includes(viewId)) return;
      switchView(viewId);
    });
  });
}

function initModules() {
  initFourAnswers(document.getElementById('mount-analyze'));
  truthGame = new TruthOrDareGame(document.getElementById('mount-truth'));
  initAnalyze(document.getElementById('mount-sim'));
  initVipGuides(document.getElementById('mount-vip'));
}

export async function initApp() {
  if (!document.getElementById('mount-analyze')) {
    throw new Error('DOM לא נטען — חסר #mount-analyze');
  }

  setAnalyzing(false);
  if (typeof window !== 'undefined') {
    window.isAnalyzing = false;
    window.setAnalyzing = setAnalyzing;
  }

  initNav();
  initModules();
  switchView('analyze');
}

export function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}
