import { initAnalyze } from './modules/analyze.js';
import { TruthOrDareGame } from './modules/truth-or-dare.js';
import { initAlphaSim } from './modules/alpha-sim.js';
import { initVipGuides } from './modules/vip-guides.js';

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
      const id = btn.dataset.view;
      if (!VIEWS.includes(id)) return;
      switchView(id);
    });
  });
}

function initModules() {
  initAnalyze(document.getElementById('mount-analyze'));
  truthGame = new TruthOrDareGame(document.getElementById('mount-truth'));
  initAlphaSim(document.getElementById('mount-sim'));
  initVipGuides(document.getElementById('mount-vip'));
}

export async function initApp() {
  if (!document.getElementById('mount-analyze')) {
    throw new Error('DOM לא נטען');
  }

  initNav();
  initModules();
  switchView('truth');
  refreshIcons();
}

export function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

