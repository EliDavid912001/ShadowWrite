import { postJson } from '../api.js';

const HER_OPENERS = [
  'היי 😊 איך היה היום שלך?',
  'את נראה מעניין בפרופיל. מה אתה עושה בחיים?',
  'חחח אתה מצחיק. ספר לי משהו עליך.',
  'למה לקח לך כל כך הרבה זמן לענות?'
];

export function initAlphaSim(container) {
  let locked = false;
  let glitchMsg = '';
  let glitchHint = '';
  let history = [];

  container.innerHTML = `
    <div class="section-eyebrow">Alpha Training</div>
    <h2 class="section-title">סימולטור אלפא</h2>
    <p class="section-desc">צ'אט עם אווטאר — תגובת בטא = BUG + נעילה. תקן ותמשיך.</p>
    <div class="card card-pad sim-arena" id="simArena">
      <div class="sim-chat-wrap" style="position:relative">
        <div class="glitch-overlay" id="glitchOverlay">
          <div class="glitch-title">BUG DETECTED</div>
          <div class="glitch-sub" id="glitchError"></div>
          <div class="glitch-hint" id="glitchHint"></div>
        </div>
        <div class="sim-chat" id="simChat"></div>
      </div>
      <div class="sim-input-row">
        <input type="text" class="text-input" id="simInput" placeholder="ערס — קצר, יודע, סוף פסוק..." maxlength="400" autocomplete="off" />
        <button type="button" class="btn-primary sim-send" id="simSend" aria-label="שלח">
          <i data-lucide="send"></i>
        </button>
      </div>
    </div>`;

  const chat = container.querySelector('#simChat');
  const input = container.querySelector('#simInput');
  const sendBtn = container.querySelector('#simSend');
  const arena = container.querySelector('#simArena');
  const overlay = container.querySelector('#glitchOverlay');
  const glitchError = container.querySelector('#glitchError');
  const glitchHint = container.querySelector('#glitchHint');

  function addBubble(text, who) {
    const b = document.createElement('div');
    b.className = `sim-bubble ${who}`;
    b.textContent = text;
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }

  function herReply() {
    const replies = [
      'מעניין... ומה אתה באמת מחפש?',
      'חחח אוקיי. אתה תמיד ככה?',
      'אהה. ספר עוד.',
      'נשמע שאתה בטוח בעצמך. אני אוהבת את זה.'
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  function setLocked(v) {
    locked = v;
    overlay.classList.toggle('active', v);
  }

  function showGlitch(errorHe, hint) {
    glitchError.textContent = errorHe;
    glitchHint.textContent = '↳ ' + hint + ' — שלח מחדש כשמוכן.';
    setLocked(true);
    input.disabled = false;
    sendBtn.disabled = false;
  }

  async function evaluateMessage(msg) {
    try {
      return await postJson('/api/alpha-sim', {
        message: msg,
        context: history.slice(-4).join(' | ')
      });
    } catch {
      const needy = /סורי|מצטער|אם זה בסדר|הכל בסדר|למה לא|מצטערת|אשמח אם|ממש מקווה/i;
      return {
        isBeta: needy.test(msg),
        errorHe: 'תגובה נויה — יותר מדי הסבר, יותר מדי בקשת אישור.',
        reframeHint: 'קצר. ערס. יודע — בלי להתנצל.'
      };
    }
  }

  let pendingBubble = null;

  async function onSend() {
    const msg = input.value.trim();
    if (!msg) return;

    sendBtn.disabled = true;
    const evalResult = await evaluateMessage(msg);
    sendBtn.disabled = false;

    if (evalResult.isBeta) {
      if (!locked) {
        pendingBubble = document.createElement('div');
        pendingBubble.className = 'sim-bubble you';
        pendingBubble.textContent = msg;
        chat.appendChild(pendingBubble);
        chat.scrollTop = chat.scrollHeight;
      } else if (pendingBubble) {
        pendingBubble.textContent = msg;
      }
      showGlitch(evalResult.errorHe || 'VALUE DROP', evalResult.reframeHint || 'נסח מחדש — ושלח שוב.');
      input.value = '';
      input.focus();
      return;
    }

    setLocked(false);
    if (!pendingBubble) {
      addBubble(msg, 'you');
    } else {
      pendingBubble.textContent = msg;
      pendingBubble = null;
    }
    history.push('user: ' + msg);
    input.value = '';

    setTimeout(() => {
      const reply = herReply();
      addBubble(reply, 'her');
      history.push('her: ' + reply);
    }, 500 + Math.random() * 350);
  }

  sendBtn.addEventListener('click', onSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  });

  addBubble(HER_OPENERS[0], 'her');
  history.push('her: ' + HER_OPENERS[0]);
}
