import type { HistoryContentType } from '../models/entities/history.model';

export type AssistantReplyLanguage = 'Portuguese' | 'English' | 'Japanese';

export function truncateAssistantText(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n…';
}

export function buildQaSystemPrompt(
  type: HistoryContentType,
  title: string,
  language: AssistantReplyLanguage
): string {
  const base = [
    `You are a reading assistant for the work "${title}".`,
    'Answer the user\'s question using ONLY the context provided below.',
    `Reply in ${language}. Be concise and clear.`
  ].join('\n');

  const noise = `
IMPORTANT INSTRUCTIONS:
- The context may contain OCR artifacts, broken characters, or formatting noise. Ignore these and focus on extracting meaning from recognizable words and sentences.
- If the context is too noisy, garbled, or consists mostly of random characters to understand, respond clearly stating that the text could not be read properly.
- If the answer is not present in the context, say that you could not find the answer in the provided excerpt (translated to ${language}).
- Do NOT invent information that is not in the context.
- Do NOT output raw OCR artifacts or meaningless character sequences in your response.`.trim();

  const typeSpecific =
    type === 'MANGA'
      ? `- You are analyzing manga/comic pages. The text may come from speech bubbles extracted via OCR and may be fragmented. Try to reconstruct dialogue flow.
- If images are provided, use visual context to complement text understanding.`
      : `- You are analyzing an ebook/novel. The text should be mostly well-structured paragraphs.
- Pay attention to chapter titles and narrative flow when answering.`;

  return `${base}\n\n${noise}\n\n${typeSpecific}`;
}

export function buildQaUserPrompt(contextBody: string, question: string, maxChars: number): string {
  const body = truncateAssistantText(contextBody, maxChars);
  return `Context:\n${body}\n\nQuestion: ${question}`;
}

export function buildSummarySystemPrompt(language: AssistantReplyLanguage): string {
  return [
    'You are a reading assistant. Summarize the recent chapters below so the reader can refresh their memory before continuing.',
    `Reply in ${language}. Be concise (about 150-250 words). Cover key characters, plot points and unresolved threads. Do not invent facts.`
  ].join(' ');
}

export function buildSummaryUserPrompt(title: string, chaptersText: string, maxChars: number): string {
  const body = truncateAssistantText(chaptersText, maxChars);
  return `Title: ${title}\n\nChapters:\n${body}`;
}

/** Keep last few turns within a char budget (Android parity). */
export function trimChatHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxMessages = 4,
  maxChars = 600
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const recent = messages.slice(-Math.max(1, maxMessages));
  let total = recent.reduce((n, m) => n + m.content.length, 0);
  const out = [...recent];
  while (out.length > 1 && total > maxChars) {
    const removed = out.shift();
    total -= removed?.content.length || 0;
  }
  return out;
}

export const ASSISTANT_SUGGESTION_CHIPS = [
  'Resuma o que aconteceu',
  'Quem são os personagens principais?',
  'Explique um termo ou conceito difícil',
  'O que ainda está em aberto?'
] as const;
