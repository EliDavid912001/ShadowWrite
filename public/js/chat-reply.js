/** Extract woman plain text from POST /api/chat JSON */

export function stripThinkingLeakage(text) {
  let t = String(text ?? '').trim();
  if (!t) return '';

  t = t
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '');

  while (/\bTHINK\b/i.test(t)) {
    const idx = t.search(/\bTHINK\b/i);
    const nextHe = t.slice(idx).search(/\n[\u0590-\u05FF]/);
    if (nextHe > 0) {
      t = (t.slice(0, idx) + t.slice(idx + nextHe)).trim();
    } else {
      t = t.replace(/\bTHINK\b[\s\S]*/i, '').trim();
    }
  }

  t = t.replace(/\bTHOUGHT:\s*/gi, '');

  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || /^(THINK\b|THOUGHT:|The user|I'm still|FROZEN)/i.test(l)) return false;
      const he = (l.match(/[\u0590-\u05FF]/g) || []).length;
      const en = (l.match(/[a-zA-Z]/g) || []).length;
      if (en > 35 && he < 8) return false;
      return true;
    });

  t = (lines.length ? lines.join(' ') : t).replace(/\s{2,}/g, ' ').trim();
  const he = (t.match(/[\u0590-\u05FF]/g) || []).length;
  const en = (t.match(/[a-zA-Z]/g) || []).length;
  if (en > 45 && he < 12) return '';
  return t;
}

export function chatReplyText(data) {
  if (typeof data === 'string') return stripThinkingLeakage(data);
  if (data == null || typeof data !== 'object') return '';

  const raw =
    data.response ?? data.reply ?? data.woman_response ?? data.text ?? data.message ?? '';
  return stripThinkingLeakage(String(raw));
}
