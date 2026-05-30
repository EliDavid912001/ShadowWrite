import { initFourAnswers } from './modules/four-answers.js';
import { initAnalyze } from './modules/analyze.js';
import { TruthOrDareGame } from './modules/truth-or-dare.js';
import { initVipGuides } from './modules/vip-guides.js';
import { setAnalyzing } from './simulator-state.js';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { FIREBASE_CONFIG, ADMIN_EMAIL, isFirebaseConfigured } from './firebase-config.js';

const VIEWS = ['analyze', 'truth', 'sim', 'vip'];

let truthGame = null;
let unsubUserDoc = null;

function isVipEmail(email) {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function updateCreditCountUI(credits, isVip, { admin = false, signedOut = false } = {}) {
  const creditCount = document.getElementById('creditCount');
  const creditDisplay = document.getElementById('creditDisplay');
  const vipTag = document.getElementById('vipTag');

  if (creditCount) {
    if (signedOut) creditCount.textContent = '0';
    else if (admin) creditCount.textContent = '∞';
    else creditCount.textContent = String(Math.max(0, Number(credits) || 0));
  }

  const showVip = !signedOut && (admin || isVip);
  if (vipTag) {
    vipTag.hidden = !showVip;
    vipTag.textContent = admin ? '👑 VIP' : '✦ VIP';
    vipTag.classList.toggle('vip-tag--admin', admin);
  }
  if (creditDisplay) {
    creditDisplay.classList.toggle('credit-display--vip', showVip);
    creditDisplay.classList.toggle('credit-display--hidden', signedOut);
  }

}

function stopUserDocListener() {
  if (unsubUserDoc) {
    unsubUserDoc();
    unsubUserDoc = null;
  }
}

/**
 * Listens to users/{uid} in Firestore and updates #creditCount when credits change.
 */
export function initCreditDisplayListener() {
  const creditCount = document.getElementById('creditCount');
  if (!creditCount) return;

  const start = async () => {
    if (window.AUTH?.waitForInitialAuth) {
      await window.AUTH.waitForInitialAuth();
    }

    stopUserDocListener();

    if (!isFirebaseConfigured() || !window.AUTH?.isReady?.()) {
      updateCreditCountUI(0, false);
      return;
    }

    const user = window.AUTH.currentUser();
    if (!user) {
      updateCreditCountUI(0, false, { signedOut: true });
      return;
    }

    const admin = window.AUTH.isAdmin();
    if (admin) {
      updateCreditCountUI('∞', true, { admin: true });
      return;
    }

    const firebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(firebaseApp);
    const userRef = doc(db, 'users', user.uid);

    unsubUserDoc = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const credits = Number(data.credits) || 0;
        const isVip = !!data.isVip || isVipEmail(user.email);
        updateCreditCountUI(credits, isVip);
      },
      (err) => {
        console.error('[app] credit listener error', err);
      }
    );
  };

  window.addEventListener('auth:changed', start);
  window.addEventListener('auth:resolved', start);
  start();
}

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
  initCreditDisplayListener();
}

export function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/* Loaded from index.html alongside auth.js — keeps #creditCount in sync with Firestore */
initCreditDisplayListener();
