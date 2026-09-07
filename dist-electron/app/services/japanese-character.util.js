"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JapaneseCharacterUtil = void 0;
/** Katakana → hiragana helpers (Android JapaneseCharacter parity). */
class JapaneseCharacterUtil {
    static KANJI = /[\u4E00-\u9FFF]/;
    static JAPANESE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
    static containsKanji(text) {
        return this.KANJI.test(text);
    }
    static containsJapanese(text) {
        return this.JAPANESE.test(text);
    }
    static toHiragana(ch) {
        if (!ch)
            return ch;
        const code = ch.charCodeAt(0);
        // Katakana ァ(0x30A1)–ヶ(0x30F6) → hiragana
        if (code >= 0x30a1 && code <= 0x30f6) {
            return String.fromCharCode(code - 0x60);
        }
        return ch;
    }
    static readingToHiragana(reading) {
        if (!reading)
            return '';
        let out = '';
        for (const c of reading) {
            out += this.toHiragana(c);
        }
        return out;
    }
}
exports.JapaneseCharacterUtil = JapaneseCharacterUtil;
