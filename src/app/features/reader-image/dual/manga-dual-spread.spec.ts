import {
  buildSpreads,
  isWideSpreadPage,
  nextSpreadIndex,
  pagesForSpread,
  prevSpreadIndex,
  primaryPageOfSpread,
  spreadIndexForPage,
  visualOrder
} from './manga-dual-spread';

describe('manga-dual-spread', () => {
  it('detects wide spreads by aspect ratio', () => {
    expect(isWideSpreadPage(1000, 1000)).toBe(true); // 1.0 > 0.9
    expect(isWideSpreadPage(900, 1000)).toBe(false); // 0.9 not greater
    expect(isWideSpreadPage(1200, 800)).toBe(true);
    expect(isWideSpreadPage(0, 100)).toBe(false);
  });

  it('keeps cover alone and pairs the rest', () => {
    const spreads = buildSpreads(5, []);
    expect(spreads).toEqual([
      { left: 0, right: null, kind: 'cover' },
      { left: 1, right: 2, kind: 'pair' },
      { left: 3, right: 4, kind: 'pair' }
    ]);
  });

  it('isolates wide pages and leaves trailing orphan alone', () => {
    // pages: 0 cover, 1-2 pair, 3 wide, 4 alone
    const wide = [false, false, false, true, false];
    const spreads = buildSpreads(5, wide);
    expect(spreads).toEqual([
      { left: 0, right: null, kind: 'cover' },
      { left: 1, right: 2, kind: 'pair' },
      { left: 3, right: null, kind: 'single-wide' },
      { left: 4, right: null, kind: 'single' }
    ]);
  });

  it('maps bookmark page to spread index', () => {
    const spreads = buildSpreads(5, []);
    expect(spreadIndexForPage(spreads, 0)).toBe(0);
    expect(spreadIndexForPage(spreads, 1)).toBe(1);
    expect(spreadIndexForPage(spreads, 2)).toBe(1);
    expect(spreadIndexForPage(spreads, 4)).toBe(2);
  });

  it('returns pages and navigates spreads', () => {
    const spreads = buildSpreads(5, []);
    expect(pagesForSpread(spreads[1])).toEqual([1, 2]);
    expect(primaryPageOfSpread(spreads[1])).toBe(1);
    expect(nextSpreadIndex(spreads, 0)).toBe(1);
    expect(nextSpreadIndex(spreads, 2)).toBe(2);
    expect(prevSpreadIndex(spreads, 1)).toBe(0);
    expect(prevSpreadIndex(spreads, 0)).toBe(0);
  });

  it('orders visually for RTL', () => {
    expect(visualOrder(1, 2, false)).toEqual([1, 2]);
    expect(visualOrder(1, 2, true)).toEqual([2, 1]);
    expect(visualOrder(0, null, true)).toEqual([0]);
  });

  it('handles single-page book', () => {
    expect(buildSpreads(1, [true])).toEqual([
      { left: 0, right: null, kind: 'single-wide' }
    ]);
  });

  it('round-trips page ↔ spread for single↔dual bookmark restore', () => {
    const wide = [false, false, true, false, false, false, false];
    const spreads = buildSpreads(7, wide);
    for (let p = 0; p < 7; p++) {
      const idx = spreadIndexForPage(spreads, p);
      const pages = pagesForSpread(spreads[idx]);
      expect(pages).toContain(p);
      const primary = primaryPageOfSpread(spreads[idx]);
      expect(spreadIndexForPage(spreads, primary)).toBe(idx);
    }
  });

  it('maps last orphan page to last spread (Home/End)', () => {
    // cover + pair(1,2) + orphan 3
    const spreads = buildSpreads(4, []);
    expect(spreads[spreads.length - 1]).toEqual({ left: 3, right: null, kind: 'single' });
    expect(spreadIndexForPage(spreads, 3)).toBe(spreads.length - 1);
    expect(primaryPageOfSpread(spreads[spreads.length - 1])).toBe(3);
  });
});
