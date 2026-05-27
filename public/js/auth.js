/**
 * Dark Script · Firebase Auth + Firestore Credits + Paywall
 *
 * Exposes `window.AUTH` for the rest of the bundle to call:
 *   window.AUTH.isReady()            → true if Firebase initialized OK
 *   window.AUTH.currentUser()        → User | null
 *   window.AUTH.isAdmin()            → boolean (matches ADMIN_EMAIL)
 *   window.AUTH.openAuthModal()      → show login/register UI
 *   window.AUTH.openPaywall()        → show VIP paywall
 *   window.AUTH.gateApiCall()        → async; throws AuthGateError if blocked
 *   window.AUTH.deductCredit(uid)    → async; returns true if 1 credit was deducted
 *
 * Gate flow:
 *   not signed in   → open auth modal       → throw AuthGateError
 *   signed in admin → bypass, return true
 *   credits > 0     → atomic decrement       → return true
 *   credits === 0   → open paywall           → throw AuthGateError
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

import {
  FIREBASE_CONFIG,
  ADMIN_EMAIL,
  DEFAULT_FREE_CREDITS,
  isFirebaseConfigured
} from './firebase-config.js';

/* ── State ──────────────────────────────────────────────────────────── */

let app = null;
let auth = null;
let db = null;
let ready = false;

let currentUser = null;
let currentCredits = 0;
let unsubCredits = null;
let authResolved = false;

class AuthGateError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'AuthGateError';
    this.reason = reason;
  }
}

/* ── Firebase init ──────────────────────────────────────────────────── */

function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.info(
      '[auth] Firebase not configured — running in open dev mode. Edit public/js/firebase-config.js to enable auth + credits.'
    );
    return false;
  }
  try {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, handleAuthStateChange);
    ready = true;
    return true;
  } catch (err) {
    console.error('[auth] Firebase init failed', err);
    return false;
  }
}

function showConfigBanner() {
  if (document.getElementById('authConfigBanner')) return;
  const el = document.createElement('div');
  el.id = 'authConfigBanner';
  el.className = 'auth-config-banner';
  el.innerHTML =
    '⚠️ Firebase לא מוגדר. ערוך את <code>public/js/firebase-config.js</code> כדי להפעיל אימות + קרדיטים.';
  document.body.appendChild(el);
}

function isAdminUser(user) {
  return !!user && !!user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/* ── Auth state ─────────────────────────────────────────────────────── */

async function handleAuthStateChange(user) {
  currentUser = user || null;
  if (user) {
    closeAuthModal();
    try {
      await createUserProfileIfMissing(user);
    } catch (err) {
      console.error('[auth] could not create/load users doc', user.uid, err);
      showProfileSyncBanner(err);
    }
    startCreditsListener(user);
  } else {
    stopCreditsListener();
    currentCredits = 0;
    renderCounter({ creditsKnown: false });
    hideProfileSyncBanner();
  }
  document.body.classList.toggle('auth-signed-in', !!user);
  updateAuthGuard();
  dispatchAuthEvent('auth:changed');
}

/**
 * Creates users/{uid} on first sign-in/sign-up.
 * credits must be exactly 1 to satisfy Firestore create rules.
 */
async function createUserProfileIfMissing(user) {
  if (!db || !user?.uid) {
    throw new Error('Firestore not initialized');
  }

  console.log('Checking user profile for:', user.email);
  await user.getIdToken(true);

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    console.log('User doc missing. Creating one now...');
    try {
      await setDoc(userRef, {
        email: user.email,
        credits: DEFAULT_FREE_CREDITS,
        isVip: isAdminUser(user),
        createdAt: serverTimestamp()
      });
      console.log('User doc created successfully!');
    } catch (error) {
      console.error('Error creating user doc:', error);
      throw error;
    }
  } else {
    console.log('User profile already exists.');
  }
}

function showProfileSyncBanner(err) {
  let el = document.getElementById('authProfileBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'authProfileBanner';
    el.className = 'auth-config-banner';
    document.body.appendChild(el);
  }
  const msg = humanizeFirebaseError(err);
  el.textContent = '⚠️ ' + msg;
  el.hidden = false;
}

function hideProfileSyncBanner() {
  const el = document.getElementById('authProfileBanner');
  if (el) el.hidden = true;
}

/* ── Auth guard (login screen vs main app) ───────────────────────────── */

function getAppShell() {
  return document.getElementById('appShell') || document.querySelector('.app-shell');
}

/**
 * Shows full-screen login when signed out; main app when signed in.
 * Dev mode (!ready): app always visible, no login wall.
 */
function updateAuthGuard() {
  const gate = document.getElementById('auth-gate');
  const app = getAppShell();
  document.body.classList.remove('auth-pending');

  if (!ready) {
    document.body.dataset.auth = 'dev';
    gate?.classList.add('hidden');
    app?.classList.remove('hidden');
    markAuthResolved();
    return;
  }

  const signedIn = !!currentUser;
  document.body.dataset.auth = signedIn ? 'signed-in' : 'signed-out';
  gate?.classList.toggle('hidden', signedIn);
  app?.classList.toggle('hidden', !signedIn);
  markAuthResolved();
}

function markAuthResolved() {
  if (authResolved) return;
  authResolved = true;
  dispatchAuthEvent('auth:resolved');
}

function dispatchAuthEvent(name) {
  window.dispatchEvent(
    new CustomEvent(name, { detail: { user: currentUser, signedIn: !!currentUser } })
  );
}

function waitForInitialAuth() {
  if (authResolved) return Promise.resolve(currentUser);
  return new Promise((resolve) => {
    const done = (e) => {
      window.removeEventListener('auth:resolved', done);
      resolve(e.detail?.user ?? currentUser);
    };
    window.addEventListener('auth:resolved', done);
    setTimeout(() => {
      window.removeEventListener('auth:resolved', done);
      resolve(currentUser);
    }, 12000);
  });
}

function focusAuthGate() {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  gate.classList.remove('hidden');
  const email = gate.querySelector('input[type="email"]');
  if (email) setTimeout(() => email.focus(), 50);
}

function startCreditsListener(user) {
  stopCreditsListener();
  if (isAdminUser(user)) {
    currentCredits = Infinity;
    renderCounter({ creditsKnown: true, admin: true });
    return;
  }
  const ref = doc(db, 'users', user.uid);
  unsubCredits = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      currentCredits = Number(data.credits) || 0;
      renderCounter({ creditsKnown: true, admin: false, credits: currentCredits });
    },
    (err) => {
      console.error('[auth] credits listener error', err);
    }
  );
}

function stopCreditsListener() {
  if (unsubCredits) {
    unsubCredits();
    unsubCredits = null;
  }
}

/* ── Public API ─────────────────────────────────────────────────────── */

function notConfiguredError() {
  const err = new Error(
    'Firebase לא מוגדר עדיין. עדכן את public/js/firebase-config.js עם הערכים שלך מ־Firebase Console ורענן את הדף.'
  );
  err.code = 'auth/not-configured';
  return err;
}

async function registerWithEmail(email, password) {
  if (!ready) throw notConfiguredError();
  const cred = await createUserWithEmailAndPassword(auth, email, password.trim());
  await createUserProfileIfMissing(cred.user);
  hideProfileSyncBanner();
  return cred.user;
}

async function loginWithEmail(email, password) {
  if (!ready) throw notConfiguredError();
  const cred = await signInWithEmailAndPassword(auth, email, password.trim());
  await createUserProfileIfMissing(cred.user);
  hideProfileSyncBanner();
  return cred.user;
}

async function logoutUser() {
  if (!ready) return;
  await signOut(auth);
}

function attachLogoutHandler() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn || logoutBtn._wired) return;
  logoutBtn._wired = true;

  logoutBtn.addEventListener('click', async () => {
    try {
      await logoutUser();
      console.log('[auth] Logged out successfully');
      window.location.reload();
    } catch (error) {
      console.error('[auth] Logout failed:', error);
    }
  });
}

/**
 * Deduct 1 credit from users/{userId}.
 * Returns true if deduction succeeded, false if balance is 0 or doc missing.
 * Admin (ADMIN_EMAIL) always returns true without touching Firestore.
 */
async function deductCredit(userId) {
  if (!ready || !db) {
    console.warn('[auth] deductCredit skipped — Firebase not ready');
    return true;
  }
  if (!userId) return false;

  if (currentUser?.uid === userId && isAdminUser(currentUser)) {
    return true;
  }

  const userRef = doc(db, 'users', userId);

  try {
    const userSnap = await getDoc(userRef);
    const credits = userSnap.exists() ? Number(userSnap.data().credits) || 0 : 0;

    if (credits <= 0) {
      console.log('[auth] Not enough credits!');
      return false;
    }

    await updateDoc(userRef, {
      credits: increment(-1),
      lastUsedAt: serverTimestamp()
    });
    console.log('[auth] Credit deducted!');
    return true;
  } catch (err) {
    console.error('[auth] deductCredit error', err);
    return false;
  }
}

/**
 * MUST be awaited before any AI fetch or paid action.
 * - throws AuthGateError if user not signed in or out of credits.
 * - calls deductCredit for the signed-in user.
 */
async function gateApiCall() {
  if (!ready) {
    return true;
  }
  if (!currentUser) {
    focusAuthGate();
    throw new AuthGateError('not-signed-in');
  }
  if (isAdminUser(currentUser)) return true;

  const success = await deductCredit(currentUser.uid);
  if (!success) {
    openPaywall();
    throw new AuthGateError('no-credits');
  }
  return true;
}

/**
 * Helper for buttons: deduct credit, then run action.
 * Returns false and opens paywall/login if blocked.
 */
async function withCredit(action) {
  try {
    await gateApiCall();
    if (typeof action === 'function') await action();
    return true;
  } catch (err) {
    if (err instanceof AuthGateError) return false;
    throw err;
  }
}

/* ── Counter UI (header pill) ────────────────────────────────────────── */

function renderCounter({ creditsKnown, admin = false, credits = 0 }) {
  const el = document.getElementById('creditCounter');
  if (!el) return;
  el.classList.remove(
    'credit-counter--empty',
    'credit-counter--admin',
    'credit-counter--anon',
    'credit-counter--dev'
  );
  if (!ready) {
    /* Open dev mode — no Firebase yet */
    el.innerHTML = '<span class="cc-icon">🔓</span><span class="cc-text">דמו</span>';
    el.classList.add('credit-counter--dev');
    el.dataset.state = 'dev';
    el.title = 'מצב דמו — Firebase יוגדר אחר כך';
    return;
  }
  if (!currentUser) {
    el.innerHTML = '<span class="cc-icon">🔐</span><span class="cc-text">התחבר</span>';
    el.classList.add('credit-counter--anon');
    el.dataset.state = 'anon';
    return;
  }
  if (admin) {
    el.innerHTML = '<span class="cc-icon">👑</span><span class="cc-text">VIP</span>';
    el.classList.add('credit-counter--admin');
    el.dataset.state = 'admin';
    return;
  }
  if (!creditsKnown) {
    el.innerHTML = '<span class="cc-icon">🪙</span><span class="cc-text">…</span>';
    el.dataset.state = 'loading';
    return;
  }
  const n = Math.max(0, credits);
  el.innerHTML = `<span class="cc-icon">🪙</span><span class="cc-text">${n}</span>`;
  el.dataset.state = n === 0 ? 'empty' : 'ok';
  if (n === 0) el.classList.add('credit-counter--empty');
}

function attachCounterHandlers() {
  const el = document.getElementById('creditCounter');
  if (!el || el._wired) return;
  el._wired = true;
  el.addEventListener('click', () => {
    const state = el.dataset.state;
    if (state === 'dev') return; // open dev mode — no auth yet
    if (state === 'anon') focusAuthGate();
    else if (state === 'empty') openPaywall();
  });
}

/* ── Auth Modal ──────────────────────────────────────────────────────── */

function ensureAuthModal() {
  let el = document.getElementById('authModal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'authModal';
  el.className = 'auth-modal hidden';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="auth-modal__overlay" data-close="1"></div>
    <div class="auth-modal__panel">
      <button type="button" class="auth-modal__close" aria-label="סגור" data-close="1">✕</button>
      <div class="auth-modal__brand">DARK <span>SCRIPT</span></div>
      <div class="auth-modal__tabs" role="tablist">
        <button type="button" class="auth-tab active" data-tab="login" role="tab">התחברות</button>
        <button type="button" class="auth-tab" data-tab="register" role="tab">הרשמה</button>
      </div>
      <form class="auth-form" id="authForm" novalidate>
        <label class="auth-field">
          <span class="auth-field__label">אימייל</span>
          <input type="email" name="email" autocomplete="email" required placeholder="you@email.com" />
        </label>
        <label class="auth-field">
          <span class="auth-field__label">סיסמה</span>
          <input type="password" name="password" autocomplete="current-password" required minlength="6" placeholder="לפחות 6 תווים" />
        </label>
        <div class="auth-error hidden" id="authError"></div>
        <button type="submit" class="auth-submit" id="authSubmit">התחבר</button>
        <p class="auth-helper" id="authHelper">משתמש חדש?
          <button type="button" class="auth-link" data-tab="register">צור חשבון</button>
        </p>
      </form>
    </div>
  `;
  document.body.appendChild(el);
  wireAuthForm(el, { closable: true });
  return el;
}

function wireLoginGate() {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  wireAuthForm(gate, { closable: false });
}

function wireAuthForm(root, { closable = false } = {}) {
  if (root._authWired) return;
  root._authWired = true;

  const form = root.querySelector('form.auth-form');
  const submitBtn = root.querySelector('.auth-submit');
  const errEl = root.querySelector('.auth-error');
  const helper = root.querySelector('.auth-helper');
  if (!form || !submitBtn || !errEl) return;

  let mode = 'login';

  function setMode(next) {
    mode = next;
    root.querySelectorAll('.auth-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === mode);
    });
    submitBtn.textContent = mode === 'login' ? 'התחבר' : 'צור חשבון';
    if (helper) {
      if (mode === 'login') {
        helper.innerHTML =
          'משתמש חדש? <button type="button" class="auth-link" data-tab="register">צור חשבון</button>';
      } else {
        helper.innerHTML =
          'יש לך חשבון? <button type="button" class="auth-link" data-tab="login">התחבר</button>';
      }
    }
    showAuthError('');
  }

  function showAuthError(msg) {
    if (!msg) {
      errEl.classList.add('hidden');
      errEl.textContent = '';
      return;
    }
    errEl.classList.remove('hidden');
    errEl.textContent = msg;
  }

  root.addEventListener('click', (e) => {
    const target = e.target;
    if (closable && target.dataset?.close) closeAuthModal();
    if (target.dataset?.tab) setMode(target.dataset.tab);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAuthError('');
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (!email || !password) {
      showAuthError('נא למלא אימייל וסיסמה');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? 'מתחבר…' : 'יוצר חשבון…';
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err) {
      showAuthError(humanizeFirebaseError(err));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'התחבר' : 'צור חשבון';
    }
  });
}

function humanizeFirebaseError(err) {
  const code = err?.code || '';
  if (code === 'auth/not-configured') {
    return 'Firebase לא מוגדר. ערוך את public/js/firebase-config.js עם הערכים מ־Firebase Console.';
  }
  if (code.includes('email-already-in-use')) return 'האימייל הזה כבר רשום — נסה להתחבר.';
  if (code.includes('invalid-email')) return 'אימייל לא תקין.';
  if (code.includes('weak-password')) return 'סיסמה חלשה — לפחות 6 תווים.';
  if (code.includes('user-not-found') || code.includes('invalid-credential')) {
    return 'אימייל או סיסמה שגויים.';
  }
  if (code.includes('wrong-password')) return 'סיסמה שגויה.';
  if (code.includes('too-many-requests')) return 'יותר מדי ניסיונות — חכה רגע ונסה שוב.';
  if (code.includes('network-request-failed')) return 'אין חיבור לרשת.';
  if (code.includes('configuration-not-found') || code.includes('operation-not-allowed')) {
    return 'Email/Password לא הופעל בפרויקט. Firebase Console → Authentication → Sign-in method → Email/Password → Enable.';
  }
  if (code.includes('api-key-not-valid')) {
    return 'מפתח Firebase לא תקין — בדוק שוב את ה־apiKey ב־firebase-config.js.';
  }
  if (code.includes('permission-denied')) {
    return 'אין הרשאה ל-Firestore. ודא שפרסמת את חוקי האבטחה (Rules) בקונסולת Firebase.';
  }
  return err?.message || 'שגיאה — נסה שוב.';
}

function openAuthModal() {
  if (!currentUser && ready) {
    focusAuthGate();
    return;
  }
  const el = ensureAuthModal();
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-modal-open');
  requestAnimationFrame(() => el.classList.add('active'));
  const firstInput = el.querySelector('input[type="email"]');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeAuthModal() {
  const el = document.getElementById('authModal');
  if (!el) return;
  el.classList.remove('active');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('auth-modal-open');
}

/* ── Paywall Modal (luxury glassmorphism) ────────────────────────────── */

function ensurePaywallModal() {
  let el = document.getElementById('paywallModal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'paywallModal';
  el.className = 'paywall-modal hidden';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="paywall-modal__overlay" data-close="1"></div>
    <div class="paywall-modal__panel">
      <button type="button" class="paywall-modal__close" aria-label="סגור" data-close="1">✕</button>
      <div class="paywall-crown">👑</div>
      <h2 class="paywall-title">The Dark Script <span class="paywall-title-accent">VIP</span></h2>
      <p class="paywall-subtitle">טעימת הבסיס הסתיימה.<br/>עכשיו הזמן לשלוט בשיחה.</p>
      <ul class="paywall-perks">
        <li>גישה בלתי מוגבלת ל־4 הארכיטיפים</li>
        <li>סימולטור אלפא בכל רמות הקושי</li>
        <li>ניתוח קואץ' אחרי כל שיחה</li>
        <li>עדכונים ופיצ'רים חדשים ראשונים</li>
      </ul>
      <button type="button" class="paywall-cta" id="paywallCta">
        <span class="paywall-cta__glow"></span>
        <span class="paywall-cta__text">פתח גישה מלאה עכשיו</span>
      </button>
      <p class="paywall-foot">תשלום מאובטח · ביטול בכל עת</p>
    </div>
  `;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target.dataset?.close) closePaywall();
  });
  el.querySelector('#paywallCta').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('vip:purchase-click', { detail: { source: 'paywall' } }));
  });
  return el;
}

function openPaywall() {
  const el = ensurePaywallModal();
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('paywall-open');
  requestAnimationFrame(() => el.classList.add('active'));
}

function closePaywall() {
  const el = document.getElementById('paywallModal');
  if (!el) return;
  el.classList.remove('active');
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('paywall-open');
}

/* ── Boot ────────────────────────────────────────────────────────────── */

function boot() {
  attachCounterHandlers();
  attachLogoutHandler();
  wireLoginGate();
  ensureAuthModal();
  ensurePaywallModal();
  const ok = initFirebase();
  if (!ok) {
    renderCounter({ creditsKnown: false });
    updateAuthGuard();
    return;
  }
  renderCounter({ creditsKnown: false });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ── Expose to bundle ────────────────────────────────────────────────── */

window.AUTH = {
  isReady: () => ready,
  isSignedIn: () => !!currentUser,
  currentUser: () => currentUser,
  isAdmin: () => isAdminUser(currentUser),
  credits: () => currentCredits,
  waitForInitialAuth,
  registerWithEmail,
  loginWithEmail,
  logoutUser,
  gateApiCall,
  deductCredit,
  withCredit,
  openAuthModal,
  closeAuthModal,
  openPaywall,
  closePaywall,
  AuthGateError
};
