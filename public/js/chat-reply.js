/** Extract woman plain text from POST /api/chat JSON */

export function chatReplyText(data) {
  if (typeof data === 'string') return data.trim();
  if (data == null || typeof data !== 'object') return '';

  const raw =
    data.response ?? data.reply ?? data.woman_response ?? data.text ?? data.message ?? '';
  return String(raw).trim();
}
