import { Injectable } from '@angular/core';
import { ElectronService } from '../electron.service';
import { JapaneseTextUtil } from './japanese-text.util';

export enum TokenizerMode {
  KUROMOJI = 'KUROMOJI',
  SUDACHI = 'SUDACHI'
}

export interface TokenizedWord {
  surface: string;
  reading: string;
  baseForm: string;
  hasKanji: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JapaneseFormatterService {
  private isInitialized = false;
  private currentMode: TokenizerMode = TokenizerMode.KUROMOJI;

  // JLPT Colors matching Formatter.kt
  public static readonly JLPT_COLORS = {
    N1: '#ff4d4d',
    N2: '#e6b800',
    N3: '#00e600',
    N4: '#668cff',
    N5: '#b366ff',
    OTHER: '#b3b3b3',
    VOCABULARY: '#ff9900'
  };

  constructor(private electron: ElectronService) {}

  public async initialize(_mode: TokenizerMode = TokenizerMode.KUROMOJI): Promise<void> {
    const res = await this.electron.japaneseInit();
    if (res.engine === 'SUDACHI') this.currentMode = TokenizerMode.SUDACHI;
    else if (res.engine === 'KUROMOJI') this.currentMode = TokenizerMode.KUROMOJI;
    this.isInitialized = !!res.ok;
  }

  public setMode(mode: TokenizerMode): void {
    this.currentMode = mode;
  }

  public getMode(): TokenizerMode {
    return this.currentMode;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Generates Furigana HTML (<ruby> kanji <rt> reading </rt> </ruby>) for a given text string.
   */
  public async generateFuriganaHtml(text: string, withFurigana = true): Promise<string> {
    if (!text) return '';
    if (text.includes('{') && text.includes('}')) {
      return JapaneseTextUtil.convertToRubyHtml(text);
    }
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.electron.japaneseToRubyHtml(text, withFurigana);
  }

  /**
   * Wrap words in spans with JLPT colors based on Kanji level.
   */
  public generateKanjiColorHtml(text: string, jlptMap?: Map<string, number>): string {
    if (!text || !jlptMap) return text;

    let result = '';
    for (const char of text) {
      if (JapaneseTextUtil.containsKanji(char)) {
        const level = jlptMap.get(char);
        let color = JapaneseFormatterService.JLPT_COLORS.OTHER;
        if (level === 1) color = JapaneseFormatterService.JLPT_COLORS.N1;
        else if (level === 2) color = JapaneseFormatterService.JLPT_COLORS.N2;
        else if (level === 3) color = JapaneseFormatterService.JLPT_COLORS.N3;
        else if (level === 4) color = JapaneseFormatterService.JLPT_COLORS.N4;
        else if (level === 5) color = JapaneseFormatterService.JLPT_COLORS.N5;

        result += `<span style="color: ${color};">${char}</span>`;
      } else {
        result += char;
      }
    }
    return result;
  }
}
