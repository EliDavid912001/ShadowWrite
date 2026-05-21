import { postJson } from '../api.js';
import { SITUATIONS_DATA, QUICK_TAGS, PERSONA_INFO } from '../data/situations.js';

const AI_PERSONAS = [
  { key: 'alpha', ...PERSONA_INFO.alpha },
  { key: 'beta', ...PERSONA_INFO.beta },
  { key: 'witty', ...PERSONA_INFO.witty },
  { key: 'friendly', ...PERSONA_INFO.friendly }
];

export function initAnalyze(container) {
  let curCh = 'app';
  let loading = false;

  container.innerHTML = `
    <div class="section-eyebrow">4 Archetypes</div>
    <h2 class="section-title">מנוע התשובות</h2>
    <p class="section-desc">תאר סיטואציה — ארבעה ארכיטיפים קשיחים, בלי ריכוך.</p>

    <div class="slabel" style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px;letter-spacing:.15em">ערוץ</div>
    <div class="ch-grid" id="chGrid">
      <button type="button" class="ch-btn active" data-ch="app"><span class="nm">אפליקציה</span><span class="ds">טינדר / באמבל</span></button>
      <button type="button" class="ch-btn" data-ch="whatsapp"><span class="nm">וואטסאפ</span><span class="ds">אחרי מספר</span></button>
      <button type="button" class="ch-btn" data-ch="phone"><span class="nm">טלפון</span><span class="ds">בקול</span></button>
      <button type="button" class="ch-btn" data-ch="inperson"><span class="nm">פנים מול פנים</span><span class="ds">דייט</span></button>
    </div>

    <div class="tags-row" id="tagsRow"></div>

    <div class="input-wrap">
      <textarea class="text-input" id="aiSituation" rows="2" placeholder="תאר מה קרה — ה-AI יחזיר 4 תשובות..." maxlength="600"></textarea>
    </div>
    <button type="button" class="btn-primary" id="aiSubmit">
      <i data-lucide="zap"></i>
      קבל 4 ארכיטיפים
    </button>

    <div class="err-banner" id="aiErr"></div>
    <div class="skeleton-stack hidden" id="aiLoad"></div>
    <div class="persona-grid hidden" id="aiResults"></div>

    <div style="margin-top:24px">
      <div class="slabel" style="font-size:10px;font-weight:700;color:var(--text-muted);margin-bottom:10px">סיטואציות מוכנות</div>
      <div class="sit-cards" id="sitCards"></div>
    </div>`;

  const tagsRow = container.querySelector('#tagsRow');
  const sitCards = container.querySelector('#sitCards');
  const aiSituation = container.querySelector('#aiSituation');
  const aiSubmit = container.querySelector('#aiSubmit');
  const aiErr = container.querySelector('#aiErr');
  const aiLoad = container.querySelector('#aiLoad');
  const aiResults = container.querySelector('#aiResults');

  tagsRow.innerHTML = QUICK_TAGS.map(
    (t) => `<button type="button" class="tag-chip" data-q="${t}">${t}</button>`
  ).join('');

  container.querySelectorAll('.ch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.ch-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      curCh = btn.dataset.ch;
      renderSitCards('');
    });
  });

  tagsRow.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      aiSituation.value = chip.dataset.q;
      renderSitCards(chip.dataset.q);
    });
  });

  aiSituation.addEventListener('input', () => {
    aiSituation.style.height = 'auto';
    aiSituation.style.height = Math.min(aiSituation.scrollHeight, 140) + 'px';
  });

  aiSituation.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runAnalyze();
    }
  });

  aiSubmit.addEventListener('click', runAnalyze);

  function showErr(msg) {
    aiErr.textContent = '⚠️ ' + msg;
    aiErr.classList.add('show');
  }

  function hideErr() {
    aiErr.classList.remove('show');
  }

  function showLoad(v) {
    aiLoad.classList.toggle('hidden', !v);
    if (v) {
      aiLoad.innerHTML = [1, 2, 3, 4]
        .map(
          () => `<div class="skeleton-card"><div class="sk-line s"></div><div class="sk-line l"></div><div class="sk-line m"></div></div>`
        )
        .join('');
    }
  }

  async function runAnalyze() {
    const situation = aiSituation.value.trim();
    if (!situation || loading) return;

    loading = true;
    aiSubmit.disabled = true;
    hideErr();
    aiResults.classList.add('hidden');
    showLoad(true);

    try {
      const data = await postJson('/api/analyze', { situation, channel: curCh });
      showLoad(false);
      renderResults(data.responses);
    } catch (err) {
      showLoad(false);
      showErr(err.message || 'שגיאה');
    } finally {
      loading = false;
      aiSubmit.disabled = false;
    }
  }

  function renderResults(responses) {
    aiResults.classList.remove('hidden');
    aiResults.innerHTML = '';

    AI_PERSONAS.forEach((p, i) => {
      const txt = responses[p.key] || '—';
      const card = document.createElement('div');
      card.className = `persona-card ${p.key}`;
      card.innerHTML = `
        <div class="persona-head">
          <span class="persona-tag">${p.label}</span>
          <span style="font-size:9px;color:var(--text-muted)">${p.sub}</span>
        </div>
        <div class="persona-body" id="pb-${p.key}"></div>
        <div class="persona-foot">
          <button type="button" class="copy-btn" data-copy="${p.key}">
            <i data-lucide="copy" style="width:12px;height:12px"></i> העתק
          </button>
        </div>`;
      aiResults.appendChild(card);
      setTimeout(() => {
        card.classList.add('show');
        typeText(card.querySelector(`#pb-${p.key}`), txt);
      }, i * 80);
    });

    window._lastResponses = responses;

    aiResults.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.copy;
        const t = window._lastResponses?.[key];
        if (!t) return;
        navigator.clipboard.writeText(t).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = 'הועתק ✓';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px"></i> העתק';
            if (window.lucide) window.lucide.createIcons();
          }, 2000);
        });
      });
    });

    if (window.lucide) window.lucide.createIcons();
    aiResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function typeText(el, txt, spd = 12) {
    el.textContent = '';
    let i = 0;
    const iv = setInterval(() => {
      el.textContent += txt[i++];
      if (i >= txt.length) clearInterval(iv);
    }, spd);
  }

  function renderSitCards(query) {
    const q = (query || '').trim().toLowerCase();
    let list = SITUATIONS_DATA.filter((s) => s.ch.includes(curCh));
    if (q) {
      list = list.filter(
        (s) =>
          s.title.includes(q) ||
          s.keywords.some((k) => k.includes(q)) ||
          Object.values(s.responses).some((r) => r.text.includes(q))
      );
    }

    sitCards.innerHTML = list
      .map(
        (s) => `
      <div class="sit-card" data-id="${s.id}">
        <div class="sit-hdr">
          <span>${s.icon}</span>
          <span class="sit-title">${s.title}</span>
          <i data-lucide="chevron-left" style="width:16px;opacity:.5"></i>
        </div>
        <div class="hidden sit-body" style="padding:0 14px 14px">
          <div class="persona-grid" style="gap:8px">
            ${['alpha', 'beta', 'witty', 'friendly']
              .map((p) => {
                const pi = PERSONA_INFO[p];
                return `<div class="persona-card ${p} show" style="opacity:1;transform:none">
                  <div class="persona-head"><span class="persona-tag">${pi.label}</span></div>
                  <div class="persona-body">${s.responses[p].text}</div>
                </div>`;
              })
              .join('')}
          </div>
        </div>
      </div>`
      )
      .join('');

    sitCards.querySelectorAll('.sit-hdr').forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const card = hdr.closest('.sit-card');
        const body = card.querySelector('.sit-body');
        const open = card.classList.toggle('open');
        body.classList.toggle('hidden', !open);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderSitCards('');
}
