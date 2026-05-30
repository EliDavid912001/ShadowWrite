/**
 * Remove Gemini "thinking" / THINK leaks from visible chat text.
 */

const EN_REASONING_LINE_RE =
  /^(THINK\b|THOUGHT:|The user|I'm still|My previous|He's been|She's been|I need to|FROZEN|NEUTRAL|WARMING|OPEN\b)/i;

function hebrewCharCount(text) {
  return (String(text).match(/[\u0590-\u05FF]/g) || []).length;
}

function latinCharCount(text) {
  return (String(text).match(/[a-zA-Z]/g) || []).length;
}

function stripThinkingLeakage(text) {
  let t = String(text ?? '').trim();
  if (!t) return '';

  t = t
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .replace(/```thinking[\s\S]*?```/gi, '');

  while (/\bTHINK\b/i.test(t)) {
    const nextHebrew = t.search(/\n[\u0590-\u05FF]/);
    if (nextHebrew > 0) {
      t = (t.slice(0, t.search(/\bTHINK\b/i)) + t.slice(nextHebrew)).trim();
    } else {
      t = t.replace(/\bTHINK\b[\s\S]*/i, '').trim();
    }
  }

  t = t.replace(/\bTHOUGHT:\s*/gi, '');

  const paragraphs = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    const ranked = paragraphs
      .map((p) => ({ p, he: hebrewCharCount(p), en: latinCharCount(p) }))
      .filter((x) => x.he >= 3 && x.he >= x.en);
    if (ranked.length) {
      ranked.sort((a, b) => b.he - a.he);
      t = ranked[0].p;
    }
  }

  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || EN_REASONING_LINE_RE.test(l)) return false;
      const he = hebrewCharCount(l);
      const en = latinCharCount(l);
      if (en > 35 && he < 8) return false;
      return true;
    });

  t = (lines.length ? lines.join(' ') : t).replace(/\s{2,}/g, ' ').trim();

  if (latinCharCount(t) > 45 && hebrewCharCount(t) < 12) {
    return '';
  }

  return t;
}

/** Prefer non-thought parts from Gemini SDK response */
function extractVisibleGeminiText(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts.length) {
    const visible = parts
      .filter((p) => p && p.thought !== true)
      .map((p) => String(p.text || '').trim())
      .filter(Boolean);
    if (visible.length) {
      return stripThinkingLeakage(visible.join('\n'));
    }
  }

  try {
    return stripThinkingLeakage(response?.text?.() || '');
  } catch {
    return stripThinkingLeakage('');
  }
}

/** generationConfig snippet — disable thinking on 2.5 Flash when supported */
function geminiThinkingConfig(modelName) {
  const m = String(modelName || '').toLowerCase();
  if (m.includes('2.5-flash') && !m.includes('lite')) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  if (m.includes('flash-lite') || m.includes('2.0-flash')) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  return {};
}

module.exports = {
  stripThinkingLeakage,
  extractVisibleGeminiText,
  geminiThinkingConfig
};
