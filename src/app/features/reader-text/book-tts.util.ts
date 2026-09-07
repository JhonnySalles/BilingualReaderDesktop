export interface TtsSentence {
  text: string;
  index: number;
}

/** Split page/visible text into sentences (Android `.` / `。` parity). */
export function splitTtsSentences(raw: string): TtsSentence[] {
  const normalized = (raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const parts = normalized
    .split(/(?<=[.。!?？！…])\s+|(?<=[.。!?？！…])(?=[^\s])/u)
    .map(s => s.trim())
    .filter(Boolean);

  const sentences: TtsSentence[] = [];
  for (const part of parts) {
    if (part.length < 2 && !/[.。!?？！…]/.test(part)) continue;
    sentences.push({ text: part, index: sentences.length });
  }
  if (sentences.length === 0 && normalized.length > 0) {
    sentences.push({ text: normalized, index: 0 });
  }
  return sentences;
}

export function findSentenceIndexContaining(sentences: TtsSentence[], needle: string): number {
  const n = (needle || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return 0;
  const exact = sentences.findIndex(s => s.text.toLowerCase().includes(n));
  if (exact >= 0) return exact;
  const head = n.slice(0, Math.min(40, n.length));
  const soft = sentences.findIndex(s => s.text.toLowerCase().includes(head));
  return soft >= 0 ? soft : 0;
}

/** Extract readable text from an epub.js Contents document. */
export function extractContentsText(contents: any): string {
  try {
    const doc: Document | undefined = contents?.document;
    if (!doc?.body) return '';
    const clone = doc.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Build a CFI for the first occurrence of `text` in contents (best-effort).
 * Returns null when the range cannot be resolved.
 */
export function cfiForSentence(contents: any, text: string): string | null {
  try {
    const doc: Document | undefined = contents?.document;
    if (!doc?.body || !text) return null;
    const needle = text.replace(/\s+/g, ' ').trim();
    if (!needle) return null;

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    let full = '';
    const map: Array<{ node: Text; start: number; end: number }> = [];
    while (node) {
      const t = node as Text;
      const value = t.nodeValue || '';
      if (value) {
        const start = full.length;
        full += value;
        map.push({ node: t, start, end: full.length });
      }
      node = walker.nextNode();
    }

    const compact = full.replace(/\s+/g, ' ');
    // Prefer search on original spacing first
    let idx = full.indexOf(needle);
    let useCompact = false;
    if (idx < 0) {
      idx = compact.indexOf(needle.replace(/\s+/g, ' '));
      useCompact = idx >= 0;
    }
    if (idx < 0) return null;

    let startAbs = idx;
    let endAbs = idx + needle.length;
    if (useCompact) {
      // Approximate: map compact index back is hard; fall back to substring search in nodes
      const lowerNeedle = needle.toLowerCase();
      for (const entry of map) {
        const val = entry.node.nodeValue || '';
        const local = val.toLowerCase().indexOf(lowerNeedle.slice(0, Math.min(24, lowerNeedle.length)));
        if (local >= 0) {
          startAbs = entry.start + local;
          endAbs = Math.min(entry.end, startAbs + needle.length);
          break;
        }
      }
    }

    const startEntry = map.find(m => startAbs >= m.start && startAbs < m.end);
    const endEntry = map.find(m => endAbs > m.start && endAbs <= m.end) || startEntry;
    if (!startEntry || !endEntry) return null;

    const range = doc.createRange();
    range.setStart(startEntry.node, Math.max(0, startAbs - startEntry.start));
    range.setEnd(endEntry.node, Math.max(0, Math.min(endEntry.node.length, endAbs - endEntry.start)));

    if (typeof contents.cfiFromRange === 'function') {
      return contents.cfiFromRange(range) || null;
    }
    return null;
  } catch {
    return null;
  }
}
