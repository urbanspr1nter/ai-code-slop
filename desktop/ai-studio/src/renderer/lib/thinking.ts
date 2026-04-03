/**
 * Parse <think>...</think> tags from model output.
 * Used for both streaming (unclosed tags) and saved messages (closed tags).
 */
export function parseThinking(raw: string, allowUnclosed = false): { thinking: string; content: string } {
  if (!raw) return { thinking: '', content: '' };

  if (allowUnclosed) {
    // Streaming: tag may not be closed yet
    const match = raw.match(/^<think>([\s\S]*?)(<\/think>)?([\s\S]*)$/);
    if (match) {
      const thinking = match[1] ?? '';
      const closed = !!match[2];
      const content = closed ? (match[3] ?? '') : '';
      return { thinking: thinking.trim(), content: content.trim() };
    }
  } else {
    // Saved messages: tag must be closed
    const match = raw.match(/^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
    if (match) {
      return { thinking: match[1].trim(), content: match[2].trim() };
    }
  }

  return { thinking: '', content: raw };
}
