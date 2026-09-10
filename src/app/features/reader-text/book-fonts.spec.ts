import {
  isHorizontalSimJapaneseFont,
  resolveFontFamilyForTate,
  TATE_GAKI_UPRIGHT_FONT_CSS
} from './book-fonts';

describe('book-fonts tate helpers', () => {
  it('detects BabelStone Erjian as horizontal-sim', () => {
    expect(isHorizontalSimJapaneseFont("'BabelStoneErjian1', 'Noto Sans JP', sans-serif")).toBeTrue();
    expect(isHorizontalSimJapaneseFont("'BabelStoneErjian2', sans-serif")).toBeTrue();
    expect(isHorizontalSimJapaneseFont("'BabelStoneHan', 'Noto Sans JP', sans-serif")).toBeFalse();
    expect(isHorizontalSimJapaneseFont("'Noto Sans JP', sans-serif")).toBeFalse();
  });

  it('swaps Erjian to upright stack under tate', () => {
    const resolved = resolveFontFamilyForTate("'BabelStoneErjian1', 'Noto Sans JP', sans-serif");
    expect(resolved).toBe(TATE_GAKI_UPRIGHT_FONT_CSS);
    expect(resolved.toLowerCase()).toContain('babelstonehan');
  });

  it('keeps upright Japanese fonts under tate', () => {
    const han = "'BabelStoneHan', 'Noto Sans JP', sans-serif";
    expect(resolveFontFamilyForTate(han)).toBe(han);
  });
});
