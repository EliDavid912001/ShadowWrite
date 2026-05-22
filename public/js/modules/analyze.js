import { DEFAULT_WOMAN_OPENER } from '../data/woman-openers.js';
import { setAnalyzing, assertChatMode } from '../simulator-state.js';
import { chatReplyText } from '../chat-reply.js';
import { requestSessionAnalysis } from '../simulation-api.js';
function startPsychLoader(el, opts) {
  if (window.PSYCH_LOADER && window.PSYCH_LOADER.start) {
    return window.PSYCH_LOADER.start(el, opts);
  }
}
function stopPsychLoader(el) {
  if (window.PSYCH_LOADER && window.PSYCH_LOADER.stop) {
    window.PSYCH_LOADER.stop(el);
  }
}

const MIN_USER_TURNS = 2;

export function initAnalyze(container) {
  let curCh = 'app';
  let curStage = 'beginning';
  let loading = false;
  let chatHistory = [];
  let sessionStarted = false;

  container.innerHTML = `
    <div class="chat-sim" id="chatSimPane">
      <header class="chat-sim-header">
        <div class="chat-sim-avatar" aria-hidden="true">מ</div>
        <div class="chat-sim-meta">
          <div class="chat-sim-name">מאיה</div>
          <div class="chat-sim-status" id="chatStatus">מחוברת</div>
        </div>
      </header>

      <details class="chat-sim-settings">
        <summary>הגדרות שיחה</summary>
        <div class="stage-grid stage-grid--compact" id="stageGrid">
          <button type="button" class="ch-btn active" data-stage="beginning"><span class="nm">התחלה</span></button>
          <button type="button" class="ch-btn" data-stage="middle"><span class="nm">אמצע</span></button>
          <button type="button" class="ch-btn" data-stage="deep"><span class="nm">קשר עמוק</span><span class="ds">4+ חודשים</span></button>
        </div>
        <div class="ch-grid ch-grid--two" id="chGrid">
          <button type="button" class="ch-btn active" data-ch="app"><span class="nm">אפליקציה</span></button>
          <button type="button" class="ch-btn" data-ch="whatsapp"><span class="nm">וואטסאפ</span></button>
        </div>
        <button type="button" class="btn-secondary chat-new-btn" id="chatNewBtn">שיחה חדשה</button>
      </details>

      <div class="chat-thread-wrap" id="chatPane">
        <div class="chat-thread" id="chatThread" role="log" aria-live="polite"></div>
        <div class="psych-scan-host psych-scan-host--overlay hidden" id="coachPsychLoad" aria-live="polite"></div>
        <div class="chat-typing hidden" id="chatTyping">
          <span class="chat-typing-dots"><span></span><span></span><span></span></span>
          מאיה מקלידה
        </div>
      </div>

      <div class="err-banner" id="aiErr"></div>

      <footer class="chat-footer-bar">
        <div class="chat-composer">
          <textarea class="chat-input text-input" id="chatInput" rows="1" placeholder="הודעה..." maxlength="600" autocomplete="off"></textarea>
          <button type="button" class="chat-send-btn" id="chatSend" aria-label="שלח">➤</button>
        </div>
        <button type="button" class="btn-secondary chat-end-bottom" id="chatEndBtn" disabled>
          סיים וקבל ציון
        </button>
      </footer>
    </div>

    <div class="chat-analysis-layer hidden" id="analysisLayer" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="chat-analysis-overlay" id="analysisOverlay">
        <div class="coach-modal-panel">
          <button type="button" class="chat-analysis-close" id="analysisClose" aria-label="סגור">✕</button>
          <p class="coach-modal-eyebrow">Dating Coach</p>
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

  const chatThread = container.querySelector('#chatThread');
  const chatInput = container.querySelector('#chatInput');
  const chatSend = container.querySelector('#chatSend');
  const chatTyping = container.querySelector('#chatTyping');
  const chatEndBtn = container.querySelector('#chatEndBtn');
  const chatNewBtn = container.querySelector('#chatNewBtn');
  const aiErr = container.querySelector('#aiErr');
  const analysisLayer = container.querySelector('#analysisLayer');
  const analysisOverlay = container.querySelector('#analysisOverlay');
  const coachScoreRing = container.querySelector('#coachScoreRing');
  const analysisScore = container.querySelector('#analysisScore');
  const analysisText = container.querySelector('#analysisText');
  const analysisImprovements = container.querySelector('#analysisImprovements');
  const coachPsychLoad = container.querySelector('#coachPsychLoad');

  container.querySelectorAll('#stageGrid .ch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (sessionStarted) return;
      container.querySelectorAll('#stageGrid .ch-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      curStage = btn.dataset.stage;
    });
  });

  container.querySelectorAll('#chGrid .ch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (sessionStarted) return;
      container.querySelectorAll('#chGrid .ch-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      curCh = btn.dataset.ch;
    });
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatSend.addEventListener('click', sendMessage);
  chatEndBtn.addEventListener('click', endAndAnalyze);
  chatNewBtn.addEventListener('click', startNewChat);
  container.querySelector('#analysisClose').addEventListener('click', closeAnalysis);
  container.querySelector('#analysisDone').addEventListener('click', closeAnalysis);
  analysisOverlay.addEventListener('click', (e) => {
    if (e.target === analysisOverlay) closeAnalysis();
  });

  function showErr(msg) {
    aiErr.textContent = '⚠️ ' + msg;
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
    const row = document.createElement('div');
    row.className = `chat-row chat-row--${who}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${who}`;
    bubble.textContent = text;
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
    setAnalyzing(false);
    chatHistory = [];
    sessionStarted = false;
    chatThread.innerHTML = '';
    hideErr();
    closeAnalysis();
    setComposerEnabled(true);
    updateEndBtn();
    container.querySelectorAll('#stageGrid .ch-btn, #chGrid .ch-btn').forEach((b) => {
      b.disabled = false;
    });
    const opener = DEFAULT_WOMAN_OPENER;
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
    container.querySelectorAll('#stageGrid .ch-btn, #chGrid .ch-btn').forEach((b) => {
      b.disabled = true;
    });

    chatInput.value = '';
    chatInput.style.height = 'auto';
    appendBubble(msg, 'you');
    chatHistory.push({ role: 'user', content: msg });
    updateEndBtn();

    loading = true;
    setComposerEnabled(false);
    setTyping(true);

    try {
      const data = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation: msg, chatHistory })
      });

      let payload = {};
      try {
        payload = await data.json();
      } catch (parseErr) {
        console.error('[chat] invalid JSON', parseErr);
        throw new Error('תשובה לא תקינה מהשרת');
      }

      console.log('[chat] API response', payload);

      if (!data.ok) {
        throw new Error(payload.error || `שגיאת שרת (${data.status})`);
      }

      await delay(400 + Math.random() * 700);
      setTyping(false);

      const reply = chatReplyText(payload);
      if (!reply) {
        console.error('[chat] empty reply field', payload);
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
        relationshipStage: curStage
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
      if (coachScoreRing) coachScoreRing.style.setProperty('--coach-pct', String(current));
      if (analysisScore) analysisScore.textContent = String(current);
      if (p < 1) requestAnimationFrame(frame);
    }
    if (coachScoreRing) coachScoreRing.style.setProperty('--coach-pct', '0');
    if (analysisScore) analysisScore.textContent = '0';
    requestAnimationFrame(frame);
  }

  function showAnalysis(data) {
    animateCoachScore(data.score);
    analysisText.textContent = data.analysis || data.feedback || '';
    const improvements = data.improvements || [];
    analysisImprovements.innerHTML = improvements
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
  startNewChat();
}
