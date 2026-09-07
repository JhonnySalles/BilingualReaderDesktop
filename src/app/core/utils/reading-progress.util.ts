/**
 * Canonical reading progress helpers.
 * Storage: bookMark is a 1-based page number in [1, pages], or 0 when unread.
 * Reader runtime indices remain 0-based; convert at the persistence boundary.
 */

export function clampBookMark(mark: number, pages: number): number {
  const total = Math.max(1, pages || 1);
  const raw = Number.isFinite(mark) ? Math.floor(mark) : 0;
  if (raw <= 0) return 0;
  return Math.min(raw, total);
}

export function isUnread(mark: number): boolean {
  return !Number.isFinite(mark) || mark <= 0;
}

export function isCompleted(
  mark: number,
  pages: number,
  completed?: boolean | null
): boolean {
  if (completed) return true;
  const total = Math.max(1, pages || 1);
  return clampBookMark(mark, total) >= total;
}

export function progressPercent(
  mark: number,
  pages: number,
  completed?: boolean | null
): number {
  const total = Math.max(1, pages || 1);
  if (isCompleted(mark, total, completed)) return 100;
  const clamped = clampBookMark(mark, total);
  if (clamped <= 0) return 0;
  return Math.min(100, Math.round((clamped / total) * 100));
}

export function progressPageLabel(
  mark: number,
  pages: number,
  completed?: boolean | null,
  options?: { notStartedLabel?: string }
): string {
  const total = Math.max(1, pages || 1);
  if (isCompleted(mark, total, completed)) return 'Concluído';
  const clamped = clampBookMark(mark, total);
  if (clamped <= 0) return options?.notStartedLabel ?? 'Não iniciado';
  return `${clamped} / ${total}`;
}

/** Convert stored 1-based bookMark to reader 0-based index. */
export function toReaderIndex(mark: number, pages: number): number {
  const total = Math.max(1, pages || 1);
  const clamped = clampBookMark(mark, total);
  if (clamped <= 0) return 0;
  return Math.min(clamped - 1, total - 1);
}

/** Convert reader 0-based index to stored 1-based bookMark. */
export function fromReaderIndex(index: number, pages: number): number {
  const total = Math.max(1, pages || 1);
  const raw = Number.isFinite(index) ? Math.floor(index) : 0;
  return clampBookMark(raw + 1, total);
}
