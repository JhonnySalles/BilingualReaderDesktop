/** Katakana → hiragana helpers (Android JapaneseCharacter parity). */
export class JapaneseCharacterUtil {
  private static readonly KANJI = /[\u4E00-\u9FFF]/;
  private static readonly JAPANESE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

  public static containsKanji(text: string): boolean {
    return this.KANJI.test(text);
  }

  public static containsJapanese(text: string): boolean {
    return this.JAPANESE.test(text);
  }

  public static toHiragana(ch: string): string {
    if (!ch) return ch;
    const code = ch.charCodeAt(0);
    // Katakana ァ(0x30A1)–ヶ(0x30F6) → hiragana
    if (code >= 0x30a1 && code <= 0x30f6) {
      return String.fromCharCode(code - 0x60);
    }
    return ch;
  }

  public static readingToHiragana(reading: string): string {
    if (!reading) return '';
    let out = '';
    for (const c of reading) {
      out += this.toHiragana(c);
    }
    return out;
  }
}
