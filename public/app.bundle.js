/* The Dark Script VIP — single bundle (no ES modules, no CDN deps) */
(function () {
  'use strict';

  if (location.protocol === 'file:') {
    document.body.innerHTML =
      '<div style="padding:24px;text-align:center;font-family:sans-serif;color:#ff2a54;max-width:400px;margin:40px auto">' +
      '<h1 style="color:#fff">The Dark Script</h1>' +
      '<p>אל תפתח את הקובץ ישירות.</p>' +
      '<p>הרץ בטרמינל: <code style="background:#16161e;padding:4px 8px;border-radius:4px">npm run dev</code></p>' +
      '<p>ואז פתח: <a href="http://localhost:3000" style="color:#ffb800">http://localhost:3000</a></p></div>';
    return;
  }

  const SITUATIONS = [
    { id: 'haha', ch: ['app'], icon: '💬', title: 'חזר רק חחח', keywords: ['חחח'],
      responses: { alpha: 'זה לא תשובה', beta: 'חחח אהבתי 😄', witty: 'נגמרו מילים', friendly: 'חחח מה קורה' }},
    { id: 'ghost', ch: ['whatsapp', 'app'], icon: '👻', title: 'גוסטינג', keywords: ['גוסטינג'],
      responses: { alpha: 'יאללה ביי', beta: 'הכל בסדר?', witty: 'ה-Wi-Fi עובד', friendly: 'פני כשנוח' }},
    { id: 'early', ch: ['app', 'whatsapp'], icon: '⏰', title: 'מוקדם מדי לפגוש', keywords: ['מוקדם'],
      responses: { alpha: 'פחות מקלדת יאללה', beta: 'ברור מבין 😅 נמשיך פה', witty: 'עוד לא נישואין', friendly: 'בכיף קחי זמן' }},
    { id: 'free', ch: ['app', 'whatsapp'], icon: '✨', title: 'אמרה שהיא פנויה', keywords: ['פנויה', 'פנוי', 'פנויות'],
      responses: { alpha: 'סגור אוסף אותך', beta: 'וואי כיף 😅 מה בא לך', witty: 'נראה אם תתנהגי', friendly: 'אש יאללה' }}
  ];
  const QUICK_TAGS = ['פנויה', 'חחח', 'גוסטינג', 'מוקדם מדי', 'דייט'];

  function psychStart(el, opts) {
    if (window.PSYCH_LOADER) return window.PSYCH_LOADER.start(el, opts || {});
  }
  function psychStop(el) {
    if (window.PSYCH_LOADER) window.PSYCH_LOADER.stop(el);
  }
  var BTN_LOADING_PHRASES = [
    '🧠 מנתח דינמיקה...',
    '🐺 מחשב מדדי אלפא...',
    '🕵️‍♂️ מפענח שפת גוף...',
    '🔥 מזקק עקיצות...'
  ];

  function btnPsychStart(btn) {
    if (!btn) return;
    btnPsychStop(btn);
    if (window.PSYCH_LOADER && window.PSYCH_LOADER.startButton) {
      return window.PSYCH_LOADER.startButton(btn);
    }
    var originalText = btn.textContent;
    btn.classList.add('loading-pulse');
    btn.disabled = true;
    var idx = 0;
    btn.textContent = BTN_LOADING_PHRASES[0];
    btn._btnPsychOriginalText = originalText;
    btn._btnPsychIntervalId = setInterval(function () {
      idx = (idx + 1) % BTN_LOADING_PHRASES.length;
      btn.textContent = BTN_LOADING_PHRASES[idx];
    }, 1000);
  }

  function btnPsychStop(btn) {
    if (!btn) return;
    if (btn._btnPsychIntervalId) {
      clearInterval(btn._btnPsychIntervalId);
      btn._btnPsychIntervalId = null;
    }
    if (window.PSYCH_LOADER && window.PSYCH_LOADER.stopButton) {
      window.PSYCH_LOADER.stopButton(btn);
      return;
    }
    btn.classList.remove('loading-pulse');
    btn.disabled = false;
    btn.textContent = btn._btnPsychOriginalText || '⚡ קבל 4 ארכיטיפים';
    btn._btnPsychOriginalText = null;
  }

  /** Chat = POST /api/chat; coach = POST /api/feedback (Gemini JSON) */
  var isAnalyzing = false;
  function setAnalyzing(v) {
    isAnalyzing = !!v;
    window.isAnalyzing = isAnalyzing;
    document.body.classList.toggle('coach-modal-open', isAnalyzing);
  }
  window.isAnalyzing = false;
  window.setAnalyzing = setAnalyzing;

  function getIsVIP() {
    if (window.isVIP === true) return true;
    try {
      return localStorage.getItem('isVIP') === '1' || localStorage.getItem('isVIP') === 'true';
    } catch (e) {
      return false;
    }
  }
  var isVIP = getIsVIP();
  window.isVIP = isVIP;
  window.getIsVIP = getIsVIP;

  function chatReplyText(data) {
    if (typeof data === 'string') return data.trim();
    if (!data || typeof data !== 'object') return '';
    var raw = data.response || data.reply || data.woman_response || data.text || data.message || '';
    return String(raw).trim();
  }

  const PERSONAS = {
    alpha: { label: '🐺 אלפא', sub: 'push-pull · 2-7 מילים' },
    beta: { label: 'בטא', sub: 'רך · מתנצל' },
    witty: { label: 'שנון', sub: 'עוקץ' },
    friendly: { label: 'חברי', sub: 'חם · ישיר' }
  };
  const GUIDES = [
    { id: 'b', title: 'מדריך לבתול', sub: 'ביטחון וערך עצמי', body: '<h4>שבירת חרדה</h4><ul><li>נוכחות > מושלמות</li><li>שאלה אחת + שתיקה</li></ul><h4>בלי פדסטל</h4><ul><li>היא בן אדם, לא פרס</li><li>אל תוכיח קיום</li></ul>' },
    { id: 'm', title: 'סקס בנישואין', sub: 'מתח וקוטביות', body: '<h4>פרסים לסירוגין</h4><ul><li>ערבים לא צפויים</li><li>שינוי אנרגיה</li></ul>' },
    { id: 's', title: 'איך לא לגמור מהר', sub: 'Edging ונשימה', body: '<h4>פיזי</h4><ul><li>Edging 3-4 מחזורים</li><li>Reverse Kegels + נשיפה</li></ul>' }
  ];

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let data = {};
    try { data = await res.json(); } catch { data = { error: 'תשובה לא תקינה' }; }
    if (!res.ok) throw new Error(data.error || 'שגיאה ' + res.status);
    return data;
  }

  function $(id) { return document.getElementById(id); }

  function switchView(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var view = $('view-' + id);
    var nav = document.querySelector('.nav-btn[data-view="' + id + '"]');
    if (view) view.classList.add('active');
    if (nav) nav.classList.add('active');
  }

  function initTruth(root) {
    if (window.initTruthOrDare) window.initTruthOrDare(root);
    else root.innerHTML = '<p class="tod-error">טוען משחק...</p>';
  }

  /* ── 4 Answers (משחק 4 תשובות) ── */
  var SCENARIO_PRESETS = [
    { id: 'haha', ch: ['app', 'whatsapp'], icon: '💬', title: 'חזר רק חחח', keywords: ['חחח'],
      responses: { alpha: 'זה לא תשובה. דברי.', beta: 'חחח אהבתי 😄', witty: 'נגמרו מילים?', friendly: 'חחח מה קורה' }},
    { id: 'ghost', ch: ['whatsapp', 'app'], icon: '👻', title: 'גוסטינג', keywords: ['גוסטינג'],
      responses: { alpha: 'יאללה ביי', beta: 'הכל בסדר?', witty: 'ה-Wi-Fi עובד', friendly: 'פני כשנוח' }},
    { id: 'early', ch: ['app', 'whatsapp'], icon: '⏰', title: 'מוקדם מדי לפגוש', keywords: ['מוקדם'],
      responses: { alpha: 'פחות מקלדת יאללה', beta: 'מבין לגמרי', witty: 'גם אני לא החלטתי', friendly: 'נכיר קודם' }},
    { id: 'wa_free', ch: ['app', 'whatsapp'], icon: '✨', title: 'אמרה שהיא פנויה הערב', keywords: ['פנויה', 'פנוי'],
      responses: { alpha: 'שומעת. תתארגני ל-21:00. אוסף אותך לדרינק.', beta: 'איזה כיף! מה בא לך? 😅', witty: 'תלוי איך התנהגת. אולי דרינק.', friendly: 'אש. בירה בערב.' }}
  ];

  function normalizeScenarioResponses(data) {
    var resp = (data && data.responses) ? data.responses : (data || {});
    var out = {};
    ['alpha', 'beta', 'witty', 'friendly'].forEach(function (key) {
      var v = resp[key];
      if (v && typeof v === 'object') v = v.text || v.reply || v.message || '';
      out[key] = String(v || '').trim();
    });
    return out;
  }

  function initFourAnswers(root) {
    if (!root) {
      console.warn('[4answers] #mount-analyze not found');
      return;
    }
    var curCh = 'app', selectedStage = 'start', loading = false;
    root.innerHTML =
      '<div class="section-eyebrow">4 Archetypes</div><h2 class="section-title">מנוע התשובות</h2>' +
      '<p class="section-desc">תאר סיטואציה — 4 ארכיטיפים קשיחים.</p>' +
      '<div class="ch-grid ch-grid--two" id="scenarioChGrid">' +
      '<button type="button" class="ch-btn active" data-ch="app"><span class="nm">אפליקציה</span></button>' +
      '<button type="button" class="ch-btn" data-ch="whatsapp"><span class="nm">וואטסאפ</span></button></div>' +
      '<div class="tags-row" id="scenarioTags"></div>' +
      '<div class="rel-stage-row" id="scenarioRelStageRow" role="group" aria-label="שלב קשר">' +
      '<button type="button" class="rel-stage-chip active" data-stage="start">🧊 התחלה</button>' +
      '<button type="button" class="rel-stage-chip" data-stage="middle">🔥 אמצע</button>' +
      '<button type="button" class="rel-stage-chip" data-stage="deep">💍 עמוק</button></div>' +
      '<div class="input-wrap"><textarea class="text-input" id="scenarioInput" rows="2" placeholder="תאר מה קרה..." maxlength="600"></textarea></div>' +
      '<button type="button" class="btn-primary" id="scenarioSubmit">⚡ קבל 4 ארכיטיפים</button>' +
      '<div class="err-banner" id="scenarioErr"></div><div class="psych-scan-host hidden" id="scenarioLoad" aria-live="polite"></div>' +
      '<div class="persona-grid hidden" id="scenarioResults"></div>' +
      '<div class="sit-cards" id="scenarioPresets" style="margin-top:20px"></div>';

    var tagsRow = root.querySelector('#scenarioTags');
    var presets = root.querySelector('#scenarioPresets');
    var input = root.querySelector('#scenarioInput');
    var submitBtn = root.querySelector('#scenarioSubmit');
    var errEl = root.querySelector('#scenarioErr');
    var loadEl = root.querySelector('#scenarioLoad');
    var resultsEl = root.querySelector('#scenarioResults');
    var relStageRow = root.querySelector('#scenarioRelStageRow');

    tagsRow.innerHTML = QUICK_TAGS.map(function (t) {
      return '<button type="button" class="tag-chip" data-q="' + t + '">' + t + '</button>';
    }).join('');

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderPresets(q) {
      var ql = (q || '').toLowerCase();
      var list = SCENARIO_PRESETS.filter(function (s) { return s.ch.indexOf(curCh) >= 0; });
      if (ql) list = list.filter(function (s) {
        return s.title.indexOf(ql) >= 0 || s.keywords.some(function (k) { return k.indexOf(ql) >= 0; });
      });
      presets.innerHTML = list.map(function (s) {
        return '<div class="sit-card"><button type="button" class="sit-hdr">' +
          '<span class="sit-icon" aria-hidden="true">' + s.icon + '</span>' +
          '<span class="sit-title">' + s.title + '</span>' +
          '<span class="sit-chev" aria-hidden="true">◀</span></button>' +
          '<div class="sit-body hidden">' +
          ['alpha', 'beta', 'witty', 'friendly'].map(function (p) {
            return '<div class="persona-card ' + p + ' show"><div class="persona-head"><span class="persona-tag">' + PERSONAS[p].label + '</span></div>' +
              '<div class="persona-body">' + esc(s.responses[p]) + '</div></div>';
          }).join('') + '</div></div>';
      }).join('');
      presets.querySelectorAll('.sit-hdr').forEach(function (hdr) {
        hdr.onclick = function () {
          var card = hdr.parentElement;
          var body = card.querySelector('.sit-body');
          var chev = hdr.querySelector('.sit-chev');
          var open = card.classList.toggle('open');
          body.classList.toggle('hidden', !open);
          if (chev) chev.textContent = open ? '▼' : '◀';
        };
      });
    }

    relStageRow.querySelectorAll('.rel-stage-chip').forEach(function (chip) {
      chip.onclick = function () {
        relStageRow.querySelectorAll('.rel-stage-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        selectedStage = chip.dataset.stage;
      };
    });

    root.querySelectorAll('#scenarioChGrid .ch-btn').forEach(function (btn) {
      btn.onclick = function () {
        root.querySelectorAll('#scenarioChGrid .ch-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        curCh = btn.dataset.ch;
        renderPresets('');
      };
    });
    tagsRow.querySelectorAll('.tag-chip').forEach(function (c) {
      c.onclick = function () { input.value = c.dataset.q; renderPresets(c.dataset.q); };
    });

    submitBtn.onclick = async function () {
      var situation = input.value.trim();
      if (loading) return;
      if (!situation) {
        errEl.textContent = '⚠️ תאר סיטואציה לפני שליחה';
        errEl.classList.add('show');
        return;
      }
      loading = true;
      errEl.classList.remove('show');
      resultsEl.classList.add('hidden');
      loadEl.classList.add('hidden');
      btnPsychStart(submitBtn);
      try {
        var data = await postJson('/api/scenario', {
          situation: situation,
          channel: curCh,
          stage: selectedStage
        });
        console.log('[scenario] API response', data);
        var resp = normalizeScenarioResponses(data);
        if (!resp.alpha && !resp.beta && !resp.witty && !resp.friendly) {
          throw new Error('השרת החזיר תשובה ריקה');
        }
        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = '';
        ['alpha', 'beta', 'witty', 'friendly'].forEach(function (key, i) {
          var p = PERSONAS[key];
          var txt = resp[key] || '—';
          var card = document.createElement('div');
          card.className = 'persona-card ' + key + ' show';
          card.innerHTML = '<div class="persona-head"><span class="persona-tag">' + p.label + '</span><span style="font-size:9px;color:var(--text-muted)">' + p.sub + '</span></div>' +
            '<div class="persona-body">' + esc(txt) + '</div><div class="persona-foot"><button type="button" class="copy-btn">העתק</button></div>';
          card.querySelector('.copy-btn').onclick = function () {
            navigator.clipboard.writeText(txt);
            this.textContent = 'הועתק ✓';
          };
          resultsEl.appendChild(card);
        });
      } catch (e) {
        console.error('[scenario] request failed', e);
        errEl.textContent = '⚠️ ' + (e.message || e);
        errEl.classList.add('show');
      } finally {
        btnPsychStop(submitBtn);
        loading = false;
        submitBtn.disabled = false;
      }
    };
    input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitBtn.click(); }
    };
    renderPresets('');
  }

  /* ── Maya Chat Simulator (סימולטור אלפא — pure chat) ── */
  var DEFAULT_WOMAN_OPENER = 'היי, מה קורה? 😊';
  var WOMAN_OPENERS = [
    DEFAULT_WOMAN_OPENER,
    'חחח פרופיל מעניין. מה נסגר איתך?',
    'היי. לקח לך זמן לענות 😏'
  ];

  function initMayaChat(root) {
    var curCh = 'app', curStage = 'beginning', loading = false;
    var chatHistory = [], sessionStarted = false;
    var MIN_TURNS = 2;

    root.innerHTML =
      '<div class="chat-sim">' +
      '<header class="chat-sim-header"><div class="chat-sim-avatar">מ</div>' +
      '<div class="chat-sim-meta"><div class="chat-sim-name">מאיה</div><div class="chat-sim-status">מחוברת</div></div></header>' +
      '<details class="chat-sim-settings"><summary>הגדרות</summary>' +
      '<div class="stage-grid stage-grid--compact" id="stageGrid">' +
      '<button type="button" class="ch-btn active" data-stage="beginning"><span class="nm">התחלה</span></button>' +
      '<button type="button" class="ch-btn" data-stage="middle"><span class="nm">אמצע</span></button>' +
      '<button type="button" class="ch-btn" data-stage="deep"><span class="nm">קשר עמוק</span><span class="ds">4+ חודשים</span></button></div>' +
      '<div class="ch-grid ch-grid--two" id="chGrid">' +
      '<button type="button" class="ch-btn active" data-ch="app"><span class="nm">אפליקציה</span></button>' +
      '<button type="button" class="ch-btn" data-ch="whatsapp"><span class="nm">וואטסאפ</span></button></div>' +
      '<button type="button" class="btn-secondary chat-new-btn" id="chatNewBtn">שיחה חדשה</button></details>' +
      '<div class="chat-thread-wrap"><div class="chat-thread" id="chatThread"></div>' +
      '<div class="psych-scan-host psych-scan-host--overlay hidden" id="coachPsychLoad" aria-live="polite"></div>' +
      '<div class="chat-typing hidden" id="chatTyping"><span class="chat-typing-dots"><span></span><span></span><span></span></span>מאיה מקלידה</div></div>' +
      '<div class="err-banner" id="aiErr"></div>' +
      '<footer class="chat-footer-bar"><div class="chat-composer"><textarea class="chat-input text-input" id="chatInput" rows="1" placeholder="הודעה..." maxlength="600"></textarea>' +
      '<button type="button" class="chat-send-btn" id="chatSend">➤</button></div>' +
      '<button type="button" class="btn-secondary chat-end-bottom" id="chatEndBtn" disabled>סיים וקבל ציון</button></footer></div>' +
      '<div class="chat-analysis-layer hidden" id="analysisLayer" role="dialog" aria-modal="true" aria-hidden="true">' +
      '<div class="chat-analysis-overlay" id="analysisOverlay">' +
      '<div class="coach-modal-panel"><button type="button" class="chat-analysis-close" id="analysisClose" aria-label="סגור">✕</button>' +
      '<p class="coach-modal-eyebrow">Dating Coach</p>' +
      '<div class="coach-score-ring-wrap"><div class="coach-score-ring" id="coachScoreRing"><span class="coach-score-num" id="analysisScore">0</span></div></div>' +
      '<div class="coach-score-label">ציון / 100</div>' +
      '<p class="coach-analysis-text" id="analysisText"></p>' +
      '<h4 class="coach-tips-title">טיפים לפעם הבאה</h4>' +
      '<ul class="coach-tips-list" id="analysisImprovements"></ul>' +
      '<button type="button" class="btn-primary" id="analysisDone">סגור</button></div></div></div>';

    var chatThread = root.querySelector('#chatThread');
    var chatInput = root.querySelector('#chatInput');
    var chatSend = root.querySelector('#chatSend');
    var chatTyping = root.querySelector('#chatTyping');
    var chatEndBtn = root.querySelector('#chatEndBtn');
    var chatNewBtn = root.querySelector('#chatNewBtn');
    var aiErr = root.querySelector('#aiErr');
    var analysisLayer = root.querySelector('#analysisLayer');
    var analysisOverlay = root.querySelector('#analysisOverlay');
    var coachScoreRing = root.querySelector('#coachScoreRing');
    var analysisScore = root.querySelector('#analysisScore');
    var analysisText = root.querySelector('#analysisText');
    var analysisImprovements = root.querySelector('#analysisImprovements');
    var coachPsychLoad = root.querySelector('#coachPsychLoad');

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function animateCoachScore(target) {
      var score = Math.max(0, Math.min(100, Math.round(Number(target) || 0)));
      var start = null;
      var duration = 900;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        var current = Math.round(score * eased);
        if (coachScoreRing) coachScoreRing.style.setProperty('--coach-pct', String(current));
        if (analysisScore) analysisScore.textContent = String(current);
        if (p < 1) requestAnimationFrame(frame);
      }
      if (coachScoreRing) coachScoreRing.style.setProperty('--coach-pct', '0');
      if (analysisScore) analysisScore.textContent = '0';
      requestAnimationFrame(frame);
    }

    function showCoachModal(data) {
      animateCoachScore(data.score);
      analysisText.textContent = data.analysis || data.feedback || '';
      var tips = data.improvements || [];
      analysisImprovements.innerHTML = tips
        .map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; })
        .join('');
      document.body.classList.remove('modal-blur');
      analysisLayer.classList.remove('hidden');
      analysisLayer.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () { analysisLayer.classList.add('active'); });
    }

    function scrollThread() { chatThread.scrollTop = chatThread.scrollHeight; }
    function updateEnd() {
      var n = chatHistory.filter(function (m) { return m.role === 'user'; }).length;
      chatEndBtn.disabled = n < MIN_TURNS || loading;
    }
    function setComposer(on) { chatInput.disabled = !on; chatSend.disabled = !on; }
    function appendBubble(text, who) {
      var row = document.createElement('div');
      row.className = 'chat-row chat-row--' + who;
      var b = document.createElement('div');
      b.className = 'chat-bubble chat-bubble--' + who;
      b.textContent = text;
      row.appendChild(b);
      chatThread.appendChild(row);
      scrollThread();
    }
    function closeAnalysisModal() {
      analysisLayer.classList.remove('active');
      analysisLayer.classList.add('hidden');
      analysisLayer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('coach-modal-open', 'modal-blur');
      setAnalyzing(false);
    }
    function startNew() {
      setAnalyzing(false);
      chatHistory = [];
      sessionStarted = false;
      chatThread.innerHTML = '';
      aiErr.classList.remove('show');
      closeAnalysisModal();
      setComposer(true);
      root.querySelectorAll('#stageGrid .ch-btn, #chGrid .ch-btn').forEach(function (b) { b.disabled = false; });
      var op = DEFAULT_WOMAN_OPENER;
      chatHistory.push({ role: 'assistant', content: op });
      appendBubble(op, 'her');
      updateEnd();
      chatInput.focus();
    }
    async function sendMsg() {
      if (isAnalyzing) return;
      var msg = chatInput.value.trim();
      if (!msg || loading) return;
      setAnalyzing(false);
      aiErr.classList.remove('show');
      sessionStarted = true;
      root.querySelectorAll('#stageGrid .ch-btn, #chGrid .ch-btn').forEach(function (b) { b.disabled = true; });
      chatInput.value = '';
      appendBubble(msg, 'you');
      chatHistory.push({ role: 'user', content: msg });
      updateEnd();
      loading = true;
      setComposer(false);
      chatTyping.classList.remove('hidden');
      scrollThread();
      try {
        var res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ situation: msg, chatHistory: chatHistory })
        });
        var payload = {};
        try {
          payload = await res.json();
        } catch (parseErr) {
          console.error('[chat] invalid JSON', parseErr);
          throw new Error('תשובה לא תקינה מהשרת');
        }
        console.log('[chat] API response', payload);
        if (!res.ok) {
          throw new Error(payload.error || 'שגיאה ' + res.status);
        }
        await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 600); });
        var reply = chatReplyText(payload);
        if (!reply) {
          console.error('[chat] empty reply field', payload);
          aiErr.textContent = '⚠️ תשובה ריקה מהשרת';
          aiErr.classList.add('show');
        } else {
          appendBubble(reply, 'her');
          chatHistory.push({ role: 'assistant', content: reply });
        }
      } catch (e) {
        console.error('[chat] request failed', e);
        aiErr.textContent = '⚠️ ' + (e.message || e);
        aiErr.classList.add('show');
      }
      chatTyping.classList.add('hidden');
      loading = false;
      setComposer(true);
      updateEnd();
      chatInput.focus();
    }
    async function endAnalyze() {
      if (chatEndBtn.disabled || loading) return;
      setAnalyzing(true);
      loading = true;
      setComposer(false);
      chatEndBtn.disabled = true;
      chatEndBtn.textContent = 'מנתח...';
      psychStart(coachPsychLoad, { mode: 'coach' });
      try {
        var data = await postJson('/api/feedback', {
          chatHistory: chatHistory,
          relationshipStage: curStage
        });
        showCoachModal(data);
      } catch (e) {
        aiErr.textContent = '⚠️ ' + (e.message || e);
        aiErr.classList.add('show');
        closeAnalysisModal();
      }
      psychStop(coachPsychLoad);
      loading = false;
      chatEndBtn.textContent = 'סיים וקבל ציון';
      setComposer(true);
      updateEnd();
    }

    root.querySelectorAll('#stageGrid .ch-btn').forEach(function (btn) {
      btn.onclick = function () {
        if (sessionStarted) return;
        root.querySelectorAll('#stageGrid .ch-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        curStage = btn.dataset.stage;
      };
    });
    root.querySelectorAll('#chGrid .ch-btn').forEach(function (btn) {
      btn.onclick = function () {
        if (sessionStarted) return;
        root.querySelectorAll('#chGrid .ch-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        curCh = btn.dataset.ch;
      };
    });
    chatSend.onclick = sendMsg;
    chatInput.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
    chatEndBtn.onclick = endAnalyze;
    chatNewBtn.onclick = startNew;
    root.querySelector('#analysisClose').onclick = closeAnalysisModal;
    root.querySelector('#analysisDone').onclick = closeAnalysisModal;
    analysisOverlay.onclick = function (e) {
      if (e.target === analysisOverlay) closeAnalysisModal();
    };
    setAnalyzing(false);
    startNew();
  }

  /* ── VIP Guides ── */
  function initVip(root) {
    root.innerHTML = '<div class="section-eyebrow">VIP</div><h2 class="section-title">מדריכי פרימיום</h2><div class="guide-list" id="guideList"></div>';
    var list = root.querySelector('#guideList');
    list.innerHTML = GUIDES.map(function (g) {
      return '<article class="guide-item"><button type="button" class="guide-trigger"><div class="guide-icon-wrap">📖</div>' +
        '<div class="guide-meta"><div class="guide-title">' + g.title + '</div><div class="guide-sub">' + g.sub + '</div></div><span class="guide-chev">▼</span></button>' +
        '<div class="guide-panel"><div class="guide-content">' + g.body + '</div></div></article>';
    }).join('');
    list.querySelectorAll('.guide-trigger').forEach(function (btn) {
      btn.onclick = function () {
        var item = btn.parentElement;
        var was = item.classList.contains('open');
        list.querySelectorAll('.guide-item').forEach(function (el) { el.classList.remove('open'); });
        if (!was) item.classList.add('open');
      };
    });
  }

  function init() {
    try {
      document.querySelectorAll('.nav-btn').forEach(function (btn) {
        btn.onclick = function () { switchView(btn.dataset.view); };
      });
      initFourAnswers($('mount-analyze'));
      initTruth($('mount-truth'));
      initMayaChat($('mount-sim'));
      initVip($('mount-vip'));
      switchView('analyze');
      var err = $('boot-error');
      if (err) err.classList.add('hidden');
    } catch (e) {
      console.error(e);
      var el = $('boot-error');
      if (el) {
        el.textContent = 'שגיאה: ' + (e.message || e);
        el.classList.remove('hidden');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
