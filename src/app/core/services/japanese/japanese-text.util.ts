export class JapaneseTextUtil {
  private static readonly EXAMPLE_PATTERN = /\{([^};]+);([^};]+)\}/g;

  /**
   * Converts bracketed furigana text (e.g. "{漢字;かんじ}") into HTML <ruby> tags.
   */
  public static convertToRubyHtml(text: string): string {
    if (!text) return '';
    return text.replace(this.EXAMPLE_PATTERN, (_match, kanji, furigana) => {
      return `<ruby>${kanji}<rt>${furigana}</rt></ruby>`;
    });
  }

  /**
   * Checks if a character sequence contains Kanji (\u4E00-\u9FFF).
   */
  public static containsKanji(text: string): boolean {
    return /[\u4E00-\u9FFF]/.test(text);
  }

  /**
   * Checks if a character sequence contains Japanese characters (Hiragana, Katakana, Kanji).
   */
  public static isJapanese(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
  }
}
