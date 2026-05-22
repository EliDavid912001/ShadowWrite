import { postJson } from '../api.js';

const DEFAULT_HER_OPENER = 'היי, מה קורה? 😊';

const HER_OPENERS = [
  DEFAULT_HER_OPENER,
  'חחח פרופיל מעניין. מה נסגר איתך?',
  'היי. לקח לך זמן לענות 😏'
];

const MIN_TURNS_FOR_SUMMARY = 2;

export function initAlphaSim(container) {
  let chatHistory = [];
  let userTurnCount = 0;
  let finishing = false;

  container.innerHTML = `
    <div class="section-eyebrow">Alpha Training</div>
    <h2 class="section-title">סימולטור אלפא</h2>
    <p class="section-desc">שיחה עם בחורה — בסוף תקבל ציון, חוזקות ומה לשפר.</p>
    <div class="card card-pad sim-arena" id="simArena">
      <div class="sim-chat-wrap">
        <div class="sim-chat" id="simChat"></div>
        <div class="sim-typing hidden" id="simTyping">מקלידה...</div>
        <div class="sim-report hidden" id="simReport"></div>
      </div>
      <div class="sim-actions">
        <button type="button" class="btn-secondary sim-end-btn" id="simEndBtn" disabled>סיים וקבל ציון</button>
      </div>
      <div class="sim-input-row" id="simInputRow">
        <input type="text" class="text-input" id="simInput" placeholder="ערס — קצר, מוביל, בלי להתנצל..." maxlength="400" autocomplete="off" />
        <button type="button" class="btn-primary sim-send" id="simSend" aria-label="שלח">
          <i data-lucide="send"></i>
        </button>
      </div>
    </div>`;

  const chat = container.querySelector('#simChat');
  const input = container.querySelector('#simInput');
  const sendBtn = container.querySelector('#simSend');
  const endBtn = container.querySelector('#simEndBtn');
  const reportEl = container.querySelector('#simReport');
  const inputRow = container.querySelector('#simInputRow');
  const typingEl = container.querySelector('#simTyping');

  function addBubble(text, who) {
    const b = document.createElement('div');
    b.className = `sim-bubble ${who}`;
    b.textContent = text;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
    return b;
  }

  function updateEndBtn() {
    endBtn.disabled = userTurnCount < MIN_TURNS_FOR_SUMMARY || finishing;
  }

  function showTyping(on) {
    typingEl.classList.toggle('hidden', !on);
    if (on) chat.scrollTop = chat.scrollHeight;
  }

  function setInputEnabled(on) {
    input.disabled = !on;
    sendBtn.disabled = !on;
    inputRow.classList.toggle('sim-input-disabled', !on);
  }

  async function callSimulator(msg) {
    return postJson('/api/alpha-sim/turn', { chatHistory, userReply: msg });
  }

  async function fetchSummary() {
    return postJson('/api/alpha-sim/summary', { chatHistory });
  }

  function renderReport(report) {
    const score = report.score ?? 0;
    const grade = report.gradeLabel || '';
    const strengths = report.strengths || [];
    const improvements = report.improvements || [];
    const summary = report.summary || '';

    const strengthItems = strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
    const improveItems = improvements.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

    reportEl.innerHTML = `
      <div class="sim-report-inner">
        <div class="sim-score-block">
          <div class="sim-score-ring" data-score="${score}">${score}</div>
          <div class="sim-score-meta">
            <div class="sim-score-label">ציון השיחה</div>
            <div class="sim-grade-tag">${escapeHtml(grade)}</div>
          </div>
        </div>
        <p class="sim-report-summary">${escapeHtml(summary)}</p>
        <div class="sim-report-cols">
          <div class="sim-report-col sim-report-good">
            <h4>מה עבד טוב</h4>
            <ul>${strengthItems}</ul>
          </div>
          <div class="sim-report-col sim-report-fix">
            <h4>מה לשפר</h4>
            <ul>${improveItems}</ul>
          </div>
        </div>
        <button type="button" class="btn-primary" id="simRestartBtn">שיחה חדשה</button>
      </div>`;

    reportEl.classList.remove('hidden');
    chat.classList.add('sim-chat-dimmed');
    const ring = reportEl.querySelector('.sim-score-ring');
    if (ring) ring.style.setProperty('--score-pct', String(score));
    reportEl.querySelector('#simRestartBtn').addEventListener('click', restartSession);
    chat.scrollTop = chat.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function restartSession() {
    chatHistory = [];
    userTurnCount = 0;
    finishing = false;
    chat.innerHTML = '';
    reportEl.innerHTML = '';
    reportEl.classList.add('hidden');
    chat.classList.remove('sim-chat-dimmed');
    setInputEnabled(true);
    endBtn.disabled = true;
    const opener = DEFAULT_HER_OPENER;
    addBubble(opener, 'her');
    chatHistory.push({ role: 'assistant', content: opener });
    input.focus();
  }

  async function onEndSession() {
    if (finishing || userTurnCount < MIN_TURNS_FOR_SUMMARY) return;
    finishing = true;
    updateEndBtn();
    setInputEnabled(false);
    endBtn.textContent = 'מחשב ציון...';

    try {
      const data = await fetchSummary();
      renderReport(data.report || data);
    } catch {
      reportEl.classList.remove('hidden');
      reportEl.innerHTML =
        '<p class="sim-report-err">לא הצלחנו ליצור סיכום. נסה שוב בעוד רגע.</p>' +
        '<button type="button" class="btn-secondary" id="simRetrySummary">נסה שוב</button>';
      reportEl.querySelector('#simRetrySummary').onclick = () => {
        reportEl.classList.add('hidden');
        finishing = false;
        endBtn.textContent = 'סיים וקבל ציון';
        updateEndBtn();
        setInputEnabled(true);
        onEndSession();
      };
      setInputEnabled(true);
      finishing = false;
      endBtn.textContent = 'סיים וקבל ציון';
      updateEndBtn();
      return;
    }

    endBtn.textContent = 'סיים וקבל ציון';
    finishing = true;
    updateEndBtn();
  }

  async function onSend() {
    const msg = input.value.trim();
    if (!msg || sendBtn.disabled || finishing) return;

    setInputEnabled(false);

    let ev;
    try {
      ev = await callSimulator(msg);
    } catch (err) {
      setInputEnabled(true);
      addBubble('⚠️ ' + (err.message || 'שגיאת שרת — נסה שוב.'), 'coach');
      return;
    }

    addBubble(msg, 'you');
    chatHistory.push({ role: 'user', content: msg });
    userTurnCount += 1;
    updateEndBtn();
    input.value = '';

    const herText = (ev.nextGirlReply || '').trim();
    if (herText) {
      const delay = 400 + Math.random() * 900;
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        addBubble(herText, 'her');
        chatHistory.push({ role: 'assistant', content: herText });
        setInputEnabled(true);
        input.focus();
      }, delay);
    } else {
      setInputEnabled(true);
      input.focus();
    }
  }

  sendBtn.addEventListener('click', onSend);
  endBtn.addEventListener('click', onEndSession);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  });

  const opener = DEFAULT_HER_OPENER;
  addBubble(opener, 'her');
  chatHistory.push({ role: 'assistant', content: opener });
  updateEndBtn();
}
