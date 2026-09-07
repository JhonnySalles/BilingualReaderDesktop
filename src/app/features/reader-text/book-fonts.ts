/** System/web-safe font catalog for the book typography panel (Android FontType parity lite). */
export interface BookFontOption {
  id: string;
  label: string;
  css: string;
  sample: string;
  /** Japanese BabelStone (or other JP) face. */
  japanese?: boolean;
  /** Relative path under /assets/fonts for @font-face src. */
  fontFile?: string;
}

export const BOOK_FONT_OPTIONS: BookFontOption[] = [
  { id: 'georgia', label: 'Georgia', css: 'Georgia, serif', sample: 'Aa' },
  { id: 'times', label: 'Times', css: "'Times New Roman', Times, serif", sample: 'Aa' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif', sample: 'Aa' },
  { id: 'comic', label: 'Comic Sans', css: "'Comic Sans MS', 'Segoe UI', sans-serif", sample: 'Aa' },
  { id: 'segoe', label: 'Segoe UI', css: "'Segoe UI', system-ui, sans-serif", sample: 'Aa' },
  { id: 'system', label: 'Sistema', css: 'system-ui, sans-serif', sample: 'Aa' },
  {
    id: 'babel-erjian1',
    label: 'BabelStone Erjian 1',
    css: "'BabelStoneErjian1', 'Noto Sans JP', sans-serif",
    sample: 'あ',
    japanese: true,
    fontFile: 'babel_stone_erjian1.ttf'
  },
  {
    id: 'babel-erjian2',
    label: 'BabelStone Erjian 2',
    css: "'BabelStoneErjian2', 'Noto Sans JP', sans-serif",
    sample: 'あ',
    japanese: true,
    fontFile: 'babel_stone_erjian2.ttf'
  },
  {
    id: 'babel-han',
    label: 'BabelStone Han',
    css: "'BabelStoneHan', 'Noto Sans JP', sans-serif",
    sample: '漢',
    japanese: true,
    fontFile: 'babel_stone_han.ttf'
  }
];

export const DEFAULT_JAPANESE_FONT_CSS = BOOK_FONT_OPTIONS.find(f => f.id === 'babel-erjian1')!.css;

export function japaneseFontOptions(): BookFontOption[] {
  return BOOK_FONT_OPTIONS.filter(f => f.japanese);
}

export function westernFontOptions(): BookFontOption[] {
  return BOOK_FONT_OPTIONS.filter(f => !f.japanese);
}

export function findBookFont(cssOrId: string): BookFontOption | undefined {
  return BOOK_FONT_OPTIONS.find(f => f.id === cssOrId || f.css === cssOrId);
}

/** CSS @font-face block for BabelStone faces served from /assets/fonts/. */
export function babelStoneFontFaceCss(baseUrl = 'assets/fonts'): string {
  const faces = japaneseFontOptions().filter(f => f.fontFile);
  return faces
    .map(f => {
      const family = f.css.match(/'([^']+)'/)?.[1] || f.label;
      return `@font-face{font-family:'${family}';src:url('${baseUrl}/${f.fontFile}') format('truetype');font-display:swap;}`;
    })
    .join('\n');
}
