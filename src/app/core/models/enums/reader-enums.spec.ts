import {
  MangaScrollingMode,
  isMangaDualMode,
  isMangaHorizontalMode,
  isMangaLongStripMode,
  isMangaRtlMode,
  isMangaVerticalMode
} from './reader-enums';

describe('MangaScrollingMode helpers', () => {
  it('marks only dual modes as dual', () => {
    expect(isMangaDualMode(MangaScrollingMode.Horizontal)).toBe(false);
    expect(isMangaDualMode(MangaScrollingMode.HorizontalRtl)).toBe(false);
    expect(isMangaDualMode(MangaScrollingMode.Vertical)).toBe(false);
    expect(isMangaDualMode(MangaScrollingMode.LongStrip)).toBe(false);
    expect(isMangaDualMode(MangaScrollingMode.LongStripGap)).toBe(false);
    expect(isMangaDualMode(MangaScrollingMode.HorizontalDual)).toBe(true);
    expect(isMangaDualMode(MangaScrollingMode.HorizontalDualRtl)).toBe(true);
    expect(isMangaDualMode(MangaScrollingMode.VerticalDual)).toBe(true);
  });

  it('detects horizontal including dual LTR/RTL', () => {
    expect(isMangaHorizontalMode(MangaScrollingMode.Horizontal)).toBe(true);
    expect(isMangaHorizontalMode(MangaScrollingMode.HorizontalRtl)).toBe(true);
    expect(isMangaHorizontalMode(MangaScrollingMode.HorizontalDual)).toBe(true);
    expect(isMangaHorizontalMode(MangaScrollingMode.HorizontalDualRtl)).toBe(true);
    expect(isMangaHorizontalMode(MangaScrollingMode.Vertical)).toBe(false);
    expect(isMangaHorizontalMode(MangaScrollingMode.VerticalDual)).toBe(false);
  });

  it('detects RTL single and dual', () => {
    expect(isMangaRtlMode(MangaScrollingMode.HorizontalRtl)).toBe(true);
    expect(isMangaRtlMode(MangaScrollingMode.HorizontalDualRtl)).toBe(true);
    expect(isMangaRtlMode(MangaScrollingMode.Horizontal)).toBe(false);
    expect(isMangaRtlMode(MangaScrollingMode.HorizontalDual)).toBe(false);
  });

  it('detects vertical single and dual', () => {
    expect(isMangaVerticalMode(MangaScrollingMode.Vertical)).toBe(true);
    expect(isMangaVerticalMode(MangaScrollingMode.VerticalDual)).toBe(true);
    expect(isMangaVerticalMode(MangaScrollingMode.Horizontal)).toBe(false);
  });

  it('detects long strip modes', () => {
    expect(isMangaLongStripMode(MangaScrollingMode.LongStrip)).toBe(true);
    expect(isMangaLongStripMode(MangaScrollingMode.LongStripGap)).toBe(true);
    expect(isMangaLongStripMode(MangaScrollingMode.Vertical)).toBe(false);
  });
});
