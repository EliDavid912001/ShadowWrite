/**
 * Simulator session schema (no DB — validated on each API request)
 *
 * @typedef {Object} SimSessionPayload
 * @property {'easy'|'medium'|'hard'} difficulty - Required for chat + coach
 * @property {'app'|'whatsapp'} [channel]
 * @property {string} [relationshipStage] - start | middle | deep
 * @property {Array<{role:string,content:string}>} [chatHistory]
 * @property {string} [situation] - latest user message (/api/chat)
 */

const DIFFICULTY_VALUES = ['easy', 'medium', 'hard'];

function validateSimSessionBody(body, options = {}) {
  const requireDifficulty = options.requireDifficulty !== false;
  const b = body && typeof body === 'object' ? body : {};
  const raw = b.difficulty ?? b.difficultyLevel ?? b.level;
  const difficulty = String(raw || '')
    .trim()
    .toLowerCase();

  let normalized = 'medium';
  if (difficulty === 'easy' || difficulty === 'קל') normalized = 'easy';
  else if (difficulty === 'hard' || difficulty === 'קשה') normalized = 'hard';
  else if (difficulty === 'medium' || difficulty === 'בינוני') normalized = 'medium';
  else if (requireDifficulty && !raw) {
    return { ok: false, error: 'חובה לבחור רמת קושי (קל / בינוני / קשה)' };
  }

  return {
    ok: true,
    difficulty: normalized,
    channel: ['whatsapp', 'app'].includes(b.channel) ? b.channel : 'app',
    relationshipStage: b.relationshipStage ?? b.stage ?? 'start'
  };
}

module.exports = {
  DIFFICULTY_VALUES,
  validateSimSessionBody
};
