/** System/web-safe font catalog for the book typography panel (Android FontType parity lite). */
export interface BookFontOption {
  id: string;
  label: string;
  css: string;
  sample: string;
}

export const BOOK_FONT_OPTIONS: BookFontOption[] = [
  { id: 'georgia', label: 'Georgia', css: 'Georgia, serif', sample: 'Aa' },
  { id: 'times', label: 'Times', css: "'Times New Roman', Times, serif", sample: 'Aa' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif', sample: 'Aa' },
  { id: 'comic', label: 'Comic Sans', css: "'Comic Sans MS', 'Segoe UI', sans-serif", sample: 'Aa' },
  { id: 'segoe', label: 'Segoe UI', css: "'Segoe UI', system-ui, sans-serif", sample: 'Aa' },
  { id: 'system', label: 'Sistema', css: 'system-ui, sans-serif', sample: 'Aa' }
];
