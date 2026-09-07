import { DUAL_PAGE_RATIO } from '../../../core/models/enums/page-link-enums';

export type MangaSpreadKind = 'cover' | 'pair' | 'single-wide' | 'single';

export interface MangaSpread {
  /** Left spine index (or the only page when right is null). */
  left: number;
  /** Right spine index, or null for a single-page spread. */
  right: number | null;
  kind: MangaSpreadKind;
}

/** Same ratio used by the page-link editor for dual/spread detection. */
export function isWideSpreadPage(width: number, height: number): boolean {
  if (!height || height <= 0 || !width || width <= 0) return false;
  return width / height > DUAL_PAGE_RATIO;
}

/**
 * Build reading spreads:
 * 1. Page 0 alone as cover when pageCount > 1
 * 2. Wide pages alone (break pairing)
 * 3. Remaining consecutive pairs; trailing orphan alone
 */
export function buildSpreads(pageCount: number, wideFlags: boolean[] = []): MangaSpread[] {
  if (pageCount <= 0) return [];
  if (pageCount === 1) {
    return [{ left: 0, right: null, kind: wideFlags[0] ? 'single-wide' : 'single' }];
  }

  const spreads: MangaSpread[] = [];
  const isWide = (i: number) => !!wideFlags[i];

  // Cover alone
  spreads.push({
    left: 0,
    right: null,
    kind: isWide(0) ? 'single-wide' : 'cover'
  });

  let i = 1;
  while (i < pageCount) {
    if (isWide(i)) {
      spreads.push({ left: i, right: null, kind: 'single-wide' });
      i += 1;
      continue;
    }

    const next = i + 1;
    if (next < pageCount && !isWide(next)) {
      spreads.push({ left: i, right: next, kind: 'pair' });
      i += 2;
      continue;
    }

    // Trailing orphan or next is wide (leave for next iteration)
    spreads.push({ left: i, right: null, kind: 'single' });
    i += 1;
  }

  return spreads;
}

export function spreadIndexForPage(spreads: MangaSpread[], page: number): number {
  if (!spreads.length) return 0;
  const idx = spreads.findIndex(
    s => s.left === page || (s.right != null && s.right === page)
  );
  return idx >= 0 ? idx : 0;
}

export function pagesForSpread(spread: MangaSpread | undefined | null): number[] {
  if (!spread) return [];
  return spread.right == null ? [spread.left] : [spread.left, spread.right];
}

export function nextSpreadIndex(spreads: MangaSpread[], current: number): number {
  if (!spreads.length) return 0;
  return Math.min(current + 1, spreads.length - 1);
}

export function prevSpreadIndex(spreads: MangaSpread[], current: number): number {
  if (!spreads.length) return 0;
  return Math.max(current - 1, 0);
}

/** Visual slot order: LTR left→right; RTL right→left on screen. */
export function visualOrder(
  left: number,
  right: number | null,
  rtl: boolean
): number[] {
  if (right == null) return [left];
  return rtl ? [right, left] : [left, right];
}

export function primaryPageOfSpread(spread: MangaSpread | undefined | null): number {
  return spread?.left ?? 0;
}
