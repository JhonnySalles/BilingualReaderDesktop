export interface AssistantContextItem {
  id: string;
  label: string;
  text: string;
  /** Manga page index when applicable. */
  pageIndex?: number;
}

export function defaultMangaPageIds(currentPage: number, pageCount: number, radius = 2): string[] {
  const max = Math.max(0, pageCount - 1);
  const start = Math.max(0, currentPage - radius);
  const end = Math.min(max, currentPage + radius);
  const ids: string[] = [];
  for (let i = start; i <= end; i++) ids.push(`p:${i}`);
  return ids;
}

export function defaultBookChapterIds(items: AssistantContextItem[], maxChapters: number): string[] {
  if (!items.length) return [];
  const n = Math.max(1, Math.min(maxChapters, items.length));
  return items.slice(-n).map(i => i.id);
}

export function serializeSelection(ids: string[]): string {
  return ids.join('|');
}

export function parseSelection(raw: string): string[] {
  return String(raw || '')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
}

export function buildContextFromSelection(
  items: AssistantContextItem[],
  selectedIds: string[],
  maxChars: number
): { text: string; pageIndexes: number[]; charCount: number } {
  const set = new Set(selectedIds);
  const picked = items.filter(i => set.has(i.id));
  const parts: string[] = [];
  const pageIndexes: number[] = [];
  let total = 0;
  for (const item of picked) {
    const chunk = `### ${item.label}\n${(item.text || '').trim()}`.trim();
    if (!chunk) continue;
    if (total + chunk.length + 2 > maxChars && parts.length) break;
    parts.push(chunk);
    total += chunk.length + 2;
    if (typeof item.pageIndex === 'number') pageIndexes.push(item.pageIndex);
  }
  const text = parts.join('\n\n');
  return { text, pageIndexes, charCount: text.length };
}

export function contextMeterTone(charCount: number, maxChars: number): 'ok' | 'warn' | 'over' {
  if (maxChars <= 0) return 'ok';
  const r = charCount / maxChars;
  if (r >= 1) return 'over';
  if (r >= 0.75) return 'warn';
  return 'ok';
}
