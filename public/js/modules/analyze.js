import { SIM_DIFFICULTY_LEVELS, getSimLevel } from '../data/sim-difficulty.js';
import { setAnalyzing, assertChatMode } from '../simulator-state.js';
import { chatReplyText, stripThinkingLeakage } from '../chat-reply.js';
import { requestSessionAnalysis } from '../simulation-api.js';

function startPsychLoader(el, opts) {
  if (window.PSYCH_LOADER?.start) window.PSYCH_LOADER.start(el, opts);
}
function stopPsychLoader(el) {
  if (window.PSYCH_LOADER?.stop) window.PSYCH_LOADER.stop(el);
}

const MIN_USER_TURNS = 2;

export function initAnalyze(container) {
  let curCh = 'app';
  let curStage = 'beginning';
  let curDifficulty = null;
  let loading = false;
  let chatHistory = [];
  let sessionStarted = false;

  let chatThread;
  let chatInput;
  let chatSend;
  let chatTyping;
  let chatEndBtn;
  let chatNewBtn;
  let aiErr;
  let analysisLayer;
  let analysisOverlay;
  let coachScoreRing;
  let analysisScore;
  let analysisText;
  let analysisImprovements;
  let coachPsychLoad;

  function renderDifficultyPicker() {
    curDifficulty = null;
    sessionStarted = false;
    chatHistory = [];
    const cards = SIM_DIFFICULTY_LEVELS.map(
      (lv) =>
        `<button type="button" class="sim-diff-card ${lv.cssClass}" data-difficulty="${lv.id}">
          <div class="sim-diff-label">${lv.label}</div>
          <div class="sim-diff-sub">${lv.sub}</div>
          <div class="sim-diff-persona">${lv.personaName}</div>
        </button>`
    ).join('');
    container.innerHTML = `
      <div class="sim-difficulty-screen">
        <div class="section-eyebrow">סימולטור אלפא</div>
        <h2 class="section-title">בחר רמת קושי</h2>
        <p class="section-desc">כל רמה משנה את האישיות, הפתיחה והציון בסוף השיחה</p>
        <div class="sim-difficulty-grid">${cards}</div>
      </div>`;
    container.querySelectorAll('.sim-diff-card').forEach((card) => {
      card.addEventListener('click', () => enterChat(card.dataset.difficulty));
    });
  }

  function mountChatUI() {
    const cfg = getSimLevel(curDifficulty);
    const av = cfg.personaName.charAt(0);
    container.innerHTML = `
      <div class="chat-sim" id="chatSimPane">
        <header class="chat-sim-header">
          <div class="chat-sim-avatar" aria-hidden="true">${av}</div>
          <div class="chat-sim-meta">
            <div class="chat-sim-name">${cfg.personaName}</div>
            <div class="chat-sim-status">מחוברת · <span class="sim-diff-badge ${cfg.cssClass}">${cfg.label}</span></div>
          </div>
          <button type="button" class="chat-sim-restart" id="chatNewBtn" aria-label="שינוי רמה / שיחה חדשה" title="שינוי רמה / שיחה חדשה">↻</button>
        </header>
        <div class="chat-thread-wrap" id="chatPane">
          <div class="chat-thread" id="chatThread" role="log" aria-live="polite"></div>
          <div class="psych-scan-host psych-scan-host--overlay hidden" id="coachPsychLoad" aria-live="polite"></div>
          <div class="chat-typing hidden" id="chatTyping">
            <span class="chat-typing-dots"><span></span><span></span><span></span></span>
            ${cfg.personaName} מקלידה
          </div>
        </div>
        <div class="err-banner" id="aiErr"></div>
        <footer class="chat-footer-bar">
          <div class="chat-composer">
            <textarea class="chat-input text-input" id="chatInput" rows="1" placeholder="הודעה..." maxlength="600" autocomplete="off"></textarea>
            <button type="button" class="chat-send-btn" id="chatSend" aria-label="שלח">➤</button>
          </div>
          <button type="button" class="btn-secondary chat-end-bottom" id="chatEndBtn" disabled>סיים וקבל ציון</button>
        </footer>
      </div>
      <div class="chat-analysis-layer hidden" id="analysisLayer" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="chat-analysis-overlay" id="analysisOverlay">
          <div class="coach-modal-panel">
            <button type="button" class="chat-analysis-close" id="analysisClose" aria-label="סגור">✕</button>
            <p class="coach-modal-eyebrow">Dating Coach · ${cfg.label}</p>
            <div class="coach-score-ring-wrap">
              <div class="coach-score-ring" id="coachScoreRing"><span class="coach-score-num" id="analysisScore">0</span></div>
            </div>
            <div class="coach-score-label">ציון / 100</div>
            <p class="coach-analysis-text" id="analysisText"></p>
            <h4 class="coach-tips-title">טיפים לפעם הבאה</h4>
            <ul class="coach-tips-list" id="analysisImprovements"></ul>
            <button type="button" class="btn-primary" id="analysisDone">סגור</button>
          </div>
        </div>
      </div>`;

    chatThread = container.querySelector('#chatThread');
    chatInput = container.querySelector('#chatInput');
    chatSend = container.querySelector('#chatSend');
    chatTyping = container.querySelector('#chatTyping');
    chatEndBtn = container.querySelector('#chatEndBtn');
    chatNewBtn = container.querySelector('#chatNewBtn');
    aiErr = container.querySelector('#aiErr');
    analysisLayer = container.querySelector('#analysisLayer');
    analysisOverlay = container.querySelector('#analysisOverlay');
    coachScoreRing = container.querySelector('#coachScoreRing');
    analysisScore = container.querySelector('#analysisScore');
    analysisText = container.querySelector('#analysisText');
    analysisImprovements = container.querySelector('#analysisImprovements');
    coachPsychLoad = container.querySelector('#coachPsychLoad');

    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    chatSend.addEventListener('click', sendMessage);
    chatEndBtn.addEventListener('click', endAndAnalyze);
    chatNewBtn.addEventListener('click', renderDifficultyPicker);
    container.querySelector('#analysisClose').addEventListener('click', closeAnalysis);
    container.querySelector('#analysisDone').addEventListener('click', closeAnalysis);
    analysisOverlay.addEventListener('click', (e) => {
      if (e.target === analysisOverlay) closeAnalysis();
    });
  }

  function enterChat(difficulty) {
    curDifficulty = difficulty;
    mountChatUI();
    startNewChat();
  }

  function showErr(msg) {
    aiErr.textContent = `⚠️ ${msg}`;
    aiErr.classList.add('show');
  }
  function hideErr() {
    aiErr.classList.remove('show');
  }
  function scrollThread() {
    chatThread.scrollTop = chatThread.scrollHeight;
  }
  function updateEndBtn() {
    const userTurns = chatHistory.filter((m) => m.role === 'user').length;
    chatEndBtn.disabled = userTurns < MIN_USER_TURNS || loading;
  }
  function appendBubble(text, who) {
    const clean =
      who === 'her' ? stripThinkingLeakage(text) : String(text || '').trim();
    if (who === 'her' && !clean) return;
    const row = document.createElement('div');
    row.className = `chat-row chat-row--${who}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${who}`;
    bubble.textContent = clean;
    row.appendChild(bubble);
    chatThread.appendChild(row);
    scrollThread();
  }
  function setTyping(on) {
    chatTyping.classList.toggle('hidden', !on);
    if (on) scrollThread();
  }
  function setComposerEnabled(on) {
    chatInput.disabled = !on;
    chatSend.disabled = !on;
  }

  function startNewChat() {
    const cfg = getSimLevel(curDifficulty);
    setAnalyzing(false);
    chatHistory = [];
    sessionStarted = false;
    chatThread.innerHTML = '';
    hideErr();
    closeAnalysis();
    setComposerEnabled(true);
    updateEndBtn();
    const opener = cfg.opener;
    chatHistory.push({ role: 'assistant', content: opener });
    appendBubble(opener, 'her');
    chatInput.focus();
  }

  async function sendMessage() {
    assertChatMode();
    const msg = chatInput.value.trim();
    if (!msg || loading) return;
    setAnalyzing(false);
    hideErr();
    sessionStarted = true;
    chatInput.value = '';
    chatInput.style.height = 'auto';
    appendBubble(msg, 'you');
    chatHistory.push({ role: 'user', content: msg });
    updateEndBtn();
    loading = true;
    setComposerEnabled(false);
    setTyping(true);
    try {
      const chatUrl =
        (typeof window !== 'undefined' && window.API_CONFIG?.apiUrl)
          ? window.API_CONFIG.apiUrl('/api/chat')
          : '/api/chat';
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation: msg,
          chatHistory,
          difficulty: curDifficulty,
          channel: curCh,
          relationshipStage: curStage
        })
      });
      let payload = {};
      try {
        payload = await res.json();
      } catch (parseErr) {
        console.error('[chat] invalid JSON', parseErr);
        throw new Error('תשובה לא תקינה מהשרת');
      }
      if (!res.ok) throw new Error(payload.error || `שגיאת שרת (${res.status})`);
      await delay(400 + Math.random() * 700);
      setTyping(false);
      const reply = chatReplyText(payload);
      if (!reply) {
        showErr('תשובה ריקה מהשרת');
        return;
      }
      appendBubble(reply, 'her');
      chatHistory.push({ role: 'assistant', content: reply });
    } catch (err) {
      console.error('[chat] request failed', err);
      setTyping(false);
      showErr(err.message || 'שגיאה');
    } finally {
      loading = false;
      setComposerEnabled(true);
      updateEndBtn();
      chatInput.focus();
    }
  }

  async function endAndAnalyze() {
    if (chatEndBtn.disabled || loading) return;
    setAnalyzing(true);
    loading = true;
    setComposerEnabled(false);
    chatEndBtn.disabled = true;
    chatEndBtn.textContent = 'מנתח...';
    startPsychLoader(coachPsychLoad, { mode: 'coach' });
    try {
      const data = await requestSessionAnalysis({
        chatHistory,
        relationshipStage: curStage,
        difficulty: curDifficulty,
        channel: curCh
      });
      showAnalysis(data);
    } catch (err) {
      showErr(err.message || 'שגיאה בסיכום');
      closeAnalysis();
    } finally {
      stopPsychLoader(coachPsychLoad);
      loading = false;
      chatEndBtn.textContent = 'סיים וקבל ציון';
      setComposerEnabled(true);
      updateEndBtn();
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function animateCoachScore(target) {
    const score = Math.max(0, Math.min(100, Math.round(Number(target) || 0)));
    let start = null;
    const duration = 900;
    function frame(ts) {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const current = Math.round(score * eased);
      coachScoreRing?.style.setProperty('--coach-pct', String(current));
      if (analysisScore) analysisScore.textContent = String(current);
      if (p < 1) requestAnimationFrame(frame);
    }
    coachScoreRing?.style.setProperty('--coach-pct', '0');
    if (analysisScore) analysisScore.textContent = '0';
    requestAnimationFrame(frame);
  }
  function showAnalysis(data) {
    animateCoachScore(data.score);
    analysisText.textContent = data.analysis || data.feedback || '';
    analysisImprovements.innerHTML = (data.improvements || [])
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join('');
    document.body.classList.remove('modal-blur');
    analysisLayer.classList.remove('hidden');
    analysisLayer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => analysisLayer.classList.add('active'));
  }
  function closeAnalysis() {
    analysisLayer.classList.remove('active');
    analysisLayer.classList.add('hidden');
    analysisLayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('coach-modal-open', 'modal-blur');
    setAnalyzing(false);
  }
  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  setAnalyzing(false);
  renderDifficultyPicker();
}
