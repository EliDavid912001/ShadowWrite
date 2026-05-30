import { postJson } from '../api.js';
import { wireCopyButton, showUiHint, showUiError, hideUiMessage } from '../ui-helpers.js';
function startButtonPsychLoader(btn, opts) {
  if (window.PSYCH_LOADER && window.PSYCH_LOADER.startButton) {
    return window.PSYCH_LOADER.startButton(btn, opts);
  }
}
function stopButtonPsychLoader(btn) {
  if (window.PSYCH_LOADER && window.PSYCH_LOADER.stopButton) {
    window.PSYCH_LOADER.stopButton(btn);
  }
}
import { SITUATIONS_DATA } from '../data/situations.js';

const PERSONAS = {
  alpha: { label: '🐺 אלפא', sub: 'push-pull · 2-7 מילים' },
  beta: { label: 'בטא', sub: 'רך · מתנצל' },
  witty: { label: 'שנון', sub: 'עוקץ' },
  friendly: { label: 'חברי', sub: 'חם · ישיר' }
};

const QUICK_TAGS = ['פנויה', 'חחח', 'גוסטינג', 'מוקדם מדי', 'דייט'];

function responseText(entry, key) {
  const r = entry?.responses?.[key];
  if (!r) return '';
  return typeof r === 'string' ? r : r.text || '';
}

function mapSituation(s) {
  return {
    id: s.id,
    ch: s.ch,
    icon: s.icon,
    title: s.title,
    keywords: s.keywords,
    responses: {
      alpha: responseText(s, 'alpha'),
      beta: responseText(s, 'beta'),
      witty: responseText(s, 'witty'),
      friendly: responseText(s, 'friendly')
    }
  };
}

const SITUATIONS = SITUATIONS_DATA.map(mapSituation);

function normalizeScenarioResponses(data) {
  const resp = data?.responses ?? data ?? {};
  const out = {};
  for (const key of ['alpha', 'beta', 'witty', 'friendly']) {
    let v = resp[key];
    if (v && typeof v === 'object') v = v.text || v.reply || v.message || '';
    out[key] = String(v || '').trim();
  }
  return out;
}

export function initFourAnswers(container) {
  if (!container) {
    console.warn('[4answers] #mount-analyze not found');
    return;
  }
  let curCh = 'app';
  let selectedStage = 'start';
  let loading = false;

  container.innerHTML = `
    <div class="section-eyebrow">4 Archetypes</div>
    <h2 class="section-title">מנוע התשובות</h2>
    <p class="section-desc">תאר סיטואציה — 4 ארכיטיפים קשיחים.</p>

    <div class="tags-row" id="scenarioTags"></div>

    <div class="rel-stage-row" id="scenarioRelStageRow" role="group" aria-label="שלב קשר">
      <button type="button" class="rel-stage-chip active" data-stage="start">🧊 קשר בהתחלה (חודש)</button>
      <button type="button" class="rel-stage-chip" data-stage="middle">🔥 קשר אמצע (1-4)</button>
      <button type="button" class="rel-stage-chip" data-stage="deep">💍 קשר רציני (4+)</button>
    </div>

    <div class="input-wrap">
      <textarea class="text-input" id="scenarioInput" rows="2" placeholder="תאר מה קרה..." maxlength="600"></textarea>
    </div>

    <button type="button" class="btn-primary" id="scenarioSubmit">⚡ קבל 4 ארכיטיפים</button>
    <div id="scenarioErr" class="ui-hint-banner" role="status" aria-live="polite"></div>
    <div class="psych-scan-host hidden" id="scenarioLoad" aria-live="polite"></div>
    <div class="persona-grid hidden" id="scenarioResults"></div>

    <div class="sit-cards" id="scenarioPresets"></div>`;

  const tagsRow = container.querySelector('#scenarioTags');
  const presets = container.querySelector('#scenarioPresets');
  const input = container.querySelector('#scenarioInput');
  const submitBtn = container.querySelector('#scenarioSubmit');
  const errEl = container.querySelector('#scenarioErr');
  const loadEl = container.querySelector('#scenarioLoad');
  const resultsEl = container.querySelector('#scenarioResults');
  const relStageRow = container.querySelector('#scenarioRelStageRow');

  tagsRow.innerHTML = QUICK_TAGS.map(
    (t) => `<button type="button" class="tag-chip" data-q="${t}">${t}</button>`
  ).join('');

  relStageRow.querySelectorAll('.rel-stage-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      relStageRow.querySelectorAll('.rel-stage-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStage = chip.dataset.stage;
    });
  });

  tagsRow.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.q;
      renderPresets(chip.dataset.q);
    });
  });

  function renderPresets(query) {
    const q = (query || '').toLowerCase();
    let list = SITUATIONS.filter((s) => s.ch.includes(curCh));
    if (q) {
      list = list.filter(
        (s) =>
          s.title.includes(q) ||
          s.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))
      );
    }

    presets.innerHTML = list
      .map(
        (s) => `
      <div class="sit-card">
        <button type="button" class="sit-hdr">
          <span class="sit-icon" aria-hidden="true">${s.icon}</span>
          <span class="sit-title">${s.title}</span>
          <span class="sit-chev" aria-hidden="true">◀</span>
        </button>
        <div class="sit-body hidden">
          ${['alpha', 'beta', 'witty', 'friendly']
            .map(
              (p) => `
            <div class="persona-card ${p} show">
              <div class="persona-head"><span class="persona-tag">${PERSONAS[p].label}</span></div>
              <div class="persona-body">${escapeHtml(s.responses[p])}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
      )
      .join('');

    presets.querySelectorAll('.sit-hdr').forEach((hdr) => {
      hdr.addEventListener('click', () => {
        const card = hdr.closest('.sit-card');
        const body = card.querySelector('.sit-body');
        const open = card.classList.toggle('open');
        body.classList.toggle('hidden', !open);
        hdr.querySelector('.sit-chev').textContent = open ? '▼' : '◀';
      });
    });
  }

  function showResults(responses) {
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '';
    ['alpha', 'beta', 'witty', 'friendly'].forEach((key, i) => {
      const p = PERSONAS[key];
      const txt = responses[key] || '—';
      const isAlpha = key === 'alpha';
      const card = document.createElement('div');
      card.className = `persona-card ${key} show${isAlpha ? ' alpha-card' : ''}`;
      card.style.animationDelay = `${i * 0.06}s`;
      card.innerHTML = `
        <div class="persona-head">
          <span class="persona-tag">${p.label}</span>
          ${isAlpha ? '<span class="alpha-card__badge">טיפ מומחה</span>' : `<span class="persona-sub">${p.sub}</span>`}
        </div>
        <div class="persona-body">${escapeHtml(txt)}</div>
        <div class="persona-foot">
          <button type="button" class="copy-btn"></button>
        </div>`;
      wireCopyButton(card.querySelector('.copy-btn'), txt);
      resultsEl.appendChild(card);
    });
  }

  async function onSubmit() {
    const situation = input.value.trim();
    if (loading) return;
    if (!situation) {
      showUiHint(errEl, 'תאר סיטואציה לפני שליחה');
      return;
    }

    loading = true;
    hideUiMessage(errEl);
    resultsEl.classList.add('hidden');
    loadEl.classList.add('hidden');
    startButtonPsychLoader(submitBtn);

    try {
      const data = await postJson('/api/generate-script', {
        situation,
        channel: curCh,
        stage: selectedStage,
        isVip: window.AUTH?.isVip?.() === true
      });
      console.log('[scenario] API response', data);
      const responses = normalizeScenarioResponses(data);
      if (!responses.alpha && !responses.beta && !responses.witty && !responses.friendly) {
        throw new Error('השרת החזיר תשובה ריקה');
      }
      showResults(responses);
    } catch (err) {
      console.error('[scenario] request failed', err);
      showUiError(errEl, err.message || 'שגיאה');
    } finally {
      stopButtonPsychLoader(submitBtn);
      loading = false;
      submitBtn.disabled = false;
    }
  }

  submitBtn.addEventListener('click', onSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  });

  renderPresets('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
