import { postJson } from './api.js';
import { chatReplyText } from './chat-reply.js';

/** Active chat — plain text via POST /api/chat (no JSON scores) */
export async function sendChatMessage({ chatHistory, situation, difficulty, channel }) {
  const data = await postJson('/api/chat', {
    chatHistory,
    situation,
    difficulty,
    channel
  });
  return chatReplyText(data);
}

/** End button only — score + feedback */
export async function requestSessionAnalysis({
  chatHistory,
  relationshipStage,
  difficulty,
  channel
}) {
  return postJson('/api/feedback', {
    chatHistory,
    relationshipStage,
    difficulty,
    channel
  });
}
