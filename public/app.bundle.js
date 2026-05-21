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

  const TRUTH_PROMPTS = [
    'ספרי על הפעם האחרונה שחשבת על מישהו אחרת בזמן דייט — בלי לייפות.',
    'מה הדבר הכי פחדני שאת מסתירה מאנשים שמושכים אותך?',
    'אם היינו לבד עכשיו — מה היית עושה קודם: מדברת או נוגעת?',
    'דרגי את עצמך 1-10 — כמה את באמת פתוחה לסכנה רגשית הערב?',
    'מה המשפט שגבר אמר לך ועדיין חוזר לך בראש?'
  ];
  const DARE_PROMPTS = [
    'שמרי קשר עין 10 שניות — בלי לצחוק, בלי להסביר למה.',
    'תני לי שאלה שאת מפחדת לשאול אותי — עכשיו.',
    'תארי איך היית רוצה שיגעו בך — במשפט אחד, ישיר.',
    'הציעי פעילות ל-20 דקות שתעלה את המתח — בלי "נלך לקפה".'
  ];
  const SITUATIONS = [
    { id: 'haha', ch: ['app'], icon: '💬', title: 'חזר רק חחח', keywords: ['חחח'],
      responses: { alpha: 'חחח זה לא תשובה. דברי.', beta: 'חחח אהבתי 😄', witty: 'נגמרו המילים?', friendly: 'חחח. מה עושה?' }},
    { id: 'ghost', ch: ['whatsapp', 'app'], icon: '👻', title: 'גוסטינג', keywords: ['גוסטינג'],
      responses: { alpha: 'ברור. כשתרצי — את יודעת איפה למצוא אותי.', beta: 'הכל בסדר?', witty: 'ה-Wi-Fi שלי עובד.', friendly: 'פני אלי כשנוח.' }},
    { id: 'early', ch: ['app', 'whatsapp'], icon: '⏰', title: 'מוקדם מדי לפגוש', keywords: ['מוקדם'],
      responses: { alpha: 'יודע. אני לא רץ לשום מקום — את כן?', beta: 'מבין לגמרי.', witty: 'גם אני לא החלטתי.', friendly: 'נכיר קודם.' }},
    { id: 'free', ch: ['app', 'whatsapp'], icon: '✨', title: 'אמרה שהיא פנויה', keywords: ['פנויה', 'פנוי', 'פנויות'],
      responses: { alpha: 'שומעת. תתארגני ל-21:00. אוסף אותך לדרינק.', beta: 'וואי איזה כיף 😅 מה בא לך? אזרום איתך.', witty: 'פנויה? אל תעופי. אולי אמצא חלון בערב.', friendly: 'אש. בירה בערב — הכי בקליל.' }}
  ];
  const QUICK_TAGS = ['פנויה', 'חחח', 'גוסטינג', 'מוקדם מדי', 'דייט'];
  const PERSONAS = {
    alpha: { label: '🐺 אלפא', sub: 'Ars-Lite · פקודות · בלי שאלות' },
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

  /* ── Truth or Dare ── */
  function initTruth(root) {
    var mode = 'random', spinning = false, rotationY = 0, rafId = null;
    root.innerHTML =
      '<div class="tod-mode-toggle">' +
      '<button type="button" class="mode-chip active" data-mode="random">🎲 אקראי</button>' +
      '<button type="button" class="mode-chip" data-mode="truth">אמת</button>' +
      '<button type="button" class="mode-chip" data-mode="dare">חובה</button></div>' +
      '<div class="card card-pad tod-arena"><div class="tod-scene"><div class="tod-spinner" id="todSpinner">' +
      '<div class="tod-ring"><div class="tod-label truth">אמת</div><div class="tod-label dare">חובה</div></div>' +
      '<div class="bottle-group" id="todBottle"><div class="bottle-body"><div class="bottle-cork"></div>' +
      '<div class="bottle-neck"></div><div class="bottle-glass"></div></div></div><div class="tod-floor"></div></div></div>' +
      '<button type="button" class="btn-primary" id="todSpinBtn">🍾 סובב את הבקבוק</button>' +
      '<div class="tod-result" id="todResult"><div class="tod-result-card" id="todResultCard">' +
      '<div class="tod-result-type" id="todResultType"></div><p class="tod-result-text" id="todResultText"></p></div></div></div>';

    var spinner = root.querySelector('#todSpinner');
    var bottle = root.querySelector('#todBottle');
    var spinBtn = root.querySelector('#todSpinBtn');
    var resultEl = root.querySelector('#todResult');
    var resultCard = root.querySelector('#todResultCard');
    var resultType = root.querySelector('#todResultType');
    var resultText = root.querySelector('#todResultText');

    function applyRot(deg) {
      rotationY = deg;
      spinner.style.transform = 'rotateY(' + deg + 'deg)';
      bottle.style.transform = 'rotateY(' + (deg * 0.6) + 'deg)';
    }
    applyRot(0);

    root.querySelectorAll('.mode-chip').forEach(function (chip) {
      chip.onclick = function () {
        if (spinning) return;
        root.querySelectorAll('.mode-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        mode = chip.dataset.mode;
      };
    });

    spinBtn.onclick = function () {
      if (spinning) return;
      spinning = true;
      spinBtn.disabled = true;
      resultEl.classList.remove('reveal');
      var outcome = mode === 'truth' ? 'truth' : mode === 'dare' ? 'dare' : (Math.random() < 0.5 ? 'truth' : 'dare');
      var target = outcome === 'truth' ? 0 : 180;
      var cur = ((rotationY % 360) + 360) % 360;
      var delta = target - cur;
      if (delta < 0) delta += 360;
      var finalR = rotationY + (4 + Math.floor(Math.random() * 3)) * 360 + delta;
      var startR = rotationY, dur = 2600, t0 = performance.now();
      function tick(now) {
        var t = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - t, 3.2);
        applyRot(startR + (finalR - startR) * eased);
        if (t < 1) rafId = requestAnimationFrame(tick);
        else {
          spinning = false;
          spinBtn.disabled = false;
          var pool = outcome === 'truth' ? TRUTH_PROMPTS : DARE_PROMPTS;
          resultCard.className = 'tod-result-card ' + outcome + '-type';
          resultType.textContent = outcome === 'truth' ? '⚡ אמת' : '🔥 חובה';
          resultText.textContent = pool[Math.floor(Math.random() * pool.length)];
          resultEl.classList.add('reveal');
        }
      }
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };
  }

  /* ── Analyze ── */
  function initAnalyze(root) {
    var curCh = 'app', loading = false;
    root.innerHTML =
      '<div class="section-eyebrow">4 Archetypes</div><h2 class="section-title">מנוע התשובות</h2>' +
      '<p class="section-desc">תאר סיטואציה — 4 ארכיטיפים קשיחים.</p>' +
      '<div class="ch-grid" id="chGrid">' +
      '<button type="button" class="ch-btn active" data-ch="app"><span class="nm">אפליקציה</span></button>' +
      '<button type="button" class="ch-btn" data-ch="whatsapp"><span class="nm">וואטסאפ</span></button>' +
      '<button type="button" class="ch-btn" data-ch="phone"><span class="nm">טלפון</span></button>' +
      '<button type="button" class="ch-btn" data-ch="inperson"><span class="nm">פנים מול פנים</span></button></div>' +
      '<div class="tags-row" id="tagsRow"></div>' +
      '<div class="input-wrap"><textarea class="text-input" id="aiSituation" rows="2" placeholder="תאר מה קרה..." maxlength="600"></textarea></div>' +
      '<button type="button" class="btn-primary" id="aiSubmit">⚡ קבל 4 ארכיטיפים</button>' +
      '<div class="err-banner" id="aiErr"></div><div class="skeleton-stack hidden" id="aiLoad"></div>' +
      '<div class="persona-grid hidden" id="aiResults"></div>' +
      '<div style="margin-top:20px"><div class="sit-cards" id="sitCards"></div></div>';

    var tagsRow = root.querySelector('#tagsRow');
    var sitCards = root.querySelector('#sitCards');
    var aiSituation = root.querySelector('#aiSituation');
    var aiSubmit = root.querySelector('#aiSubmit');
    var aiErr = root.querySelector('#aiErr');
    var aiLoad = root.querySelector('#aiLoad');
    var aiResults = root.querySelector('#aiResults');

    tagsRow.innerHTML = QUICK_TAGS.map(function (t) {
      return '<button type="button" class="tag-chip" data-q="' + t + '">' + t + '</button>';
    }).join('');

    root.querySelectorAll('.ch-btn').forEach(function (btn) {
      btn.onclick = function () {
        root.querySelectorAll('.ch-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        curCh = btn.dataset.ch;
        renderSit('');
      };
    });
    tagsRow.querySelectorAll('.tag-chip').forEach(function (c) {
      c.onclick = function () { aiSituation.value = c.dataset.q; renderSit(c.dataset.q); };
    });

    function renderSit(q) {
      var ql = (q || '').toLowerCase();
      var list = SITUATIONS.filter(function (s) { return s.ch.indexOf(curCh) >= 0; });
      if (ql) list = list.filter(function (s) {
        return s.title.indexOf(ql) >= 0 || s.keywords.some(function (k) { return k.indexOf(ql) >= 0; });
      });
      sitCards.innerHTML = list.map(function (s) {
        return '<div class="sit-card"><div class="sit-hdr"><span>' + s.icon + '</span><span class="sit-title">' + s.title + '</span><span>◀</span></div>' +
          '<div class="hidden sit-body" style="padding:0 14px 14px">' +
          ['alpha', 'beta', 'witty', 'friendly'].map(function (p) {
            return '<div class="persona-card ' + p + ' show"><div class="persona-head"><span class="persona-tag">' + PERSONAS[p].label + '</span></div>' +
              '<div class="persona-body">' + s.responses[p] + '</div></div>';
          }).join('') + '</div></div>';
      }).join('');
      sitCards.querySelectorAll('.sit-hdr').forEach(function (hdr) {
        hdr.onclick = function () {
          var card = hdr.parentElement;
          var body = card.querySelector('.sit-body');
          var open = card.classList.toggle('open');
          body.classList.toggle('hidden', !open);
        };
      });
    }
    renderSit('');

    aiSubmit.onclick = async function () {
      var situation = aiSituation.value.trim();
      if (!situation || loading) return;
      loading = true;
      aiSubmit.disabled = true;
      aiErr.classList.remove('show');
      aiResults.classList.add('hidden');
      aiLoad.classList.remove('hidden');
      aiLoad.innerHTML = '<div class="skeleton-card"><div class="sk-line l"></div></div>'.repeat(4);
      try {
        var data = await postJson('/api/analyze', { situation: situation, channel: curCh });
        aiLoad.classList.add('hidden');
        aiResults.classList.remove('hidden');
        aiResults.innerHTML = '';
        ['alpha', 'beta', 'witty', 'friendly'].forEach(function (key, i) {
          var p = PERSONAS[key];
          var txt = data.responses[key] || '—';
          var card = document.createElement('div');
          card.className = 'persona-card ' + key + ' show';
          card.innerHTML = '<div class="persona-head"><span class="persona-tag">' + p.label + '</span><span style="font-size:9px;color:var(--text-muted)">' + p.sub + '</span></div>' +
            '<div class="persona-body">' + txt + '</div><div class="persona-foot"><button type="button" class="copy-btn">העתק</button></div>';
          card.querySelector('.copy-btn').onclick = function () {
            navigator.clipboard.writeText(txt);
            this.textContent = 'הועתק ✓';
          };
          aiResults.appendChild(card);
        });
      } catch (e) {
        aiLoad.classList.add('hidden');
        aiErr.textContent = '⚠️ ' + (e.message || e);
        aiErr.classList.add('show');
      }
      loading = false;
      aiSubmit.disabled = false;
    };
    aiSituation.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSubmit.click(); }
    };
  }

  /* ── Alpha Sim ── */
  function initSim(root) {
    var locked = false, chatHistory = [], pendingBubble = null;
    root.innerHTML =
      '<div class="section-eyebrow">Alpha Training</div><h2 class="section-title">סימולטור אלפא</h2>' +
      '<p class="section-desc">בטא = BUG. תקן ושלח שוב.</p>' +
      '<div class="card card-pad sim-arena"><div class="sim-chat-wrap">' +
      '<div class="glitch-overlay" id="glitchOverlay"><div class="glitch-title">BUG DETECTED</div>' +
      '<div class="glitch-sub" id="glitchError"></div><div class="glitch-hint" id="glitchHint"></div></div>' +
      '<div class="sim-chat" id="simChat"></div></div>' +
      '<div class="sim-input-row"><input type="text" class="text-input" id="simInput" placeholder="קצר, ערס, סוף פסוק..." maxlength="400" />' +
      '<button type="button" class="btn-primary sim-send" id="simSend">➤</button></div></div>';

    var chat = root.querySelector('#simChat');
    var input = root.querySelector('#simInput');
    var sendBtn = root.querySelector('#simSend');
    var overlay = root.querySelector('#glitchOverlay');
    var glitchError = root.querySelector('#glitchError');
    var glitchHint = root.querySelector('#glitchHint');

    function bubble(t, who) {
      var b = document.createElement('div');
      b.className = 'sim-bubble ' + who;
      b.textContent = t;
      chat.appendChild(b);
      chat.scrollTop = chat.scrollHeight;
    }
    var opener = 'היי. את נראה סבבה — מה אתה עושה בחיים?';
    bubble(opener, 'her');
    chatHistory.push({ role: 'assistant', content: opener });

    async function evalMsg(msg) {
      try {
        return await postJson('/api/simulate', { chatHistory: chatHistory, userReply: msg });
      } catch (e) {
        var dry = /^(כן|בסדר|חחח|אוקיי|נכון|טוב|יופי)\.?$/i.test(msg);
        var needy = /סורי|מצטער|אם זה בסדר|הכל בסדר|ממש מקווה/i.test(msg);
        return {
          isBeta: dry || needy,
          analysis: dry
            ? 'אתה עונה במילה אחת ומפיל עליה את האחריות להוביל. גבר ערס לא נחקר — הוא מייצר עניין או מוביל לפגישה.'
            : 'תגובה נויה — יותר מדי בקשת אישור או הסבר.',
          reframeHint: '',
          nextGirlReply: ''
        };
      }
    }

    sendBtn.onclick = async function () {
      var msg = input.value.trim();
      if (!msg) return;
      sendBtn.disabled = true;
      var ev = await evalMsg(msg);
      sendBtn.disabled = false;
      if (ev.isBeta) {
        if (!locked) {
          pendingBubble = document.createElement('div');
          pendingBubble.className = 'sim-bubble you';
          pendingBubble.textContent = msg;
          chat.appendChild(pendingBubble);
        } else if (pendingBubble) pendingBubble.textContent = msg;
        locked = true;
        overlay.classList.add('active');
        glitchError.textContent = ev.analysis || ev.errorHe || 'VALUE DROP';
        glitchHint.textContent = '↳ ' + (ev.reframeHint || 'נסח מחדש') + ' — שלח שוב';
        input.value = '';
        return;
      }
      locked = false;
      overlay.classList.remove('active');
      if (!pendingBubble) bubble(msg, 'you');
      else { pendingBubble.textContent = msg; pendingBubble = null; }
      chatHistory.push({ role: 'user', content: msg });
      input.value = '';
      var herText = (ev.nextGirlReply && ev.nextGirlReply.trim()) ? ev.nextGirlReply.trim() : ['אוקיי.', 'חחח ומה', 'יאללה', 'שמעתי'][Math.floor(Math.random() * 4)];
      setTimeout(function () {
        bubble(herText, 'her');
        chatHistory.push({ role: 'assistant', content: herText });
      }, 500);
    };
    input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } };
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
      initAnalyze($('mount-analyze'));
      initTruth($('mount-truth'));
      initSim($('mount-sim'));
      initVip($('mount-vip'));
      switchView('truth');
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
