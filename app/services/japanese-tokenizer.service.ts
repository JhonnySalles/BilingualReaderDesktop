import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { JapaneseCharacterUtil } from './japanese-character.util';

export type TokenizerEngine = 'SUDACHI' | 'KUROMOJI' | 'NONE';

export interface JapaneseToken {
  surface: string;
  readingHiragana: string;
  dictionaryForm: string;
  hasKanji: boolean;
}

type KuromojiTokenizer = {
  tokenize: (text: string) => Array<{
    surface_form: string;
    basic_form: string;
    reading?: string;
    pronunciation?: string;
  }>;
};

type SudachiMorpheme = {
  surface: () => string;
  readingForm: () => string;
  dictionaryForm: () => string;
  begin?: () => number;
  end?: () => number;
};

type SudachiTokenizer = {
  tokenize: (mode: unknown, text: string) => SudachiMorpheme[];
};

/**
 * Main-process Japanese tokenizer: Sudachi (system_small.dic) with Kuromoji fallback.
 * Mirrors Android Formatter.generateHtmlText / SplitMode.C.
 */
export class JapaneseTokenizerService {
  private static instance: JapaneseTokenizerService | null = null;

  private initPromise: Promise<void> | null = null;
  private engine: TokenizerEngine = 'NONE';
  private kuromoji: KuromojiTokenizer | null = null;
  private sudachi: SudachiTokenizer | null = null;
  private sudachiModeC: unknown = null;

  static getInstance(): JapaneseTokenizerService {
    if (!this.instance) this.instance = new JapaneseTokenizerService();
    return this.instance;
  }

  getEngine(): TokenizerEngine {
    return this.engine;
  }

  async init(): Promise<{ ok: boolean; engine: TokenizerEngine }> {
    await this.ensureReady();
    return { ok: this.engine !== 'NONE', engine: this.engine };
  }

  async tokenize(text: string): Promise<JapaneseToken[]> {
    await this.ensureReady();
    if (!text || !JapaneseCharacterUtil.containsJapanese(text)) {
      return text ? [{ surface: text, readingHiragana: '', dictionaryForm: text, hasKanji: false }] : [];
    }

    if (this.engine === 'SUDACHI' && this.sudachi) {
      try {
        return this.tokenizeSudachi(text);
      } catch (e) {
        console.warn('[japanese-tokenizer] Sudachi tokenize failed, falling back', e);
      }
    }

    if (this.kuromoji) {
      return this.tokenizeKuromoji(text);
    }

    return [{ surface: text, readingHiragana: '', dictionaryForm: text, hasKanji: JapaneseCharacterUtil.containsKanji(text) }];
  }

  async toRubyHtml(text: string, withFurigana = true): Promise<string> {
    if (!text) return '';
    if (!JapaneseCharacterUtil.containsJapanese(text)) return this.escapeHtml(text);

    await this.ensureReady();
    if (this.engine === 'NONE') return this.escapeHtml(text);

    const tokens = await this.tokenize(text);
    let html = '';
    for (const t of tokens) {
      const surface = this.escapeHtml(t.surface);
      const attrSurface = this.escapeAttr(t.surface);
      const attrBasic = this.escapeAttr(t.dictionaryForm || t.surface);
      let inner = surface;
      if (withFurigana && t.hasKanji && t.readingHiragana) {
        const rt = this.escapeHtml(t.readingHiragana);
        inner = `<ruby>${surface}<rt>${rt}</rt></ruby>`;
      }
      // Clickable vocab span for reader lookup (Android showPopupVocabulary parity).
      html += `<span class="br-vocab" data-surface="${attrSurface}" data-basic="${attrBasic}">${inner}</span>`;
    }
    return html;
  }

  private async ensureReady(): Promise<void> {
    if (this.engine !== 'NONE' && (this.sudachi || this.kuromoji)) return;
    if (!this.initPromise) {
      this.initPromise = this.loadEngines();
    }
    await this.initPromise;
  }

  private async loadEngines(): Promise<void> {
    // Prefer Sudachi when package + dictionary are available
    const sudachiOk = await this.tryLoadSudachi();
    if (sudachiOk) {
      this.engine = 'SUDACHI';
      // Still warm Kuromoji as fallback for tokenize errors
      this.kuromoji = await this.loadKuromoji();
      console.log('[japanese-tokenizer] ready engine=SUDACHI');
      return;
    }

    this.kuromoji = await this.loadKuromoji();
    if (this.kuromoji) {
      this.engine = 'KUROMOJI';
      console.log('[japanese-tokenizer] ready engine=KUROMOJI (Sudachi unavailable)');
      return;
    }

    this.engine = 'NONE';
    console.warn('[japanese-tokenizer] no tokenizer available');
  }

  private async tryLoadSudachi(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sudachiMod = require('sudachi-ts');
      const BinaryDictionary = sudachiMod.BinaryDictionary || sudachiMod.dictionary?.BinaryDictionary;
      const SplitMode = sudachiMod.SplitMode;
      if (!BinaryDictionary?.loadSystem) {
        console.warn('[japanese-tokenizer] sudachi-ts API mismatch');
        return false;
      }

      const dicPath = this.ensureSudachiDictionary();
      if (!dicPath) return false;

      const dict = await BinaryDictionary.loadSystem(dicPath);
      const tokenizer = dict.create();
      this.sudachi = tokenizer;
      this.sudachiModeC = SplitMode?.C ?? SplitMode?.c ?? 'C';
      return true;
    } catch (e) {
      console.warn('[japanese-tokenizer] Sudachi load skipped', (e as Error)?.message || e);
      return false;
    }
  }

  /** Copy packaged/public dic into userData/sudachi (Android filesDir parity). */
  private ensureSudachiDictionary(): string | null {
    try {
      const userDir = path.join(app.getPath('userData'), 'sudachi');
      const dest = path.join(userDir, 'system_small.dic');
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        return dest;
      }

      const sources = this.sudachiDicCandidates();
      const src = sources.find(p => {
        try {
          return p && fs.existsSync(p) && fs.statSync(p).size > 0;
        } catch {
          return false;
        }
      });
      if (!src) {
        console.warn('[japanese-tokenizer] system_small.dic not found', sources);
        return null;
      }

      fs.mkdirSync(userDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log('[japanese-tokenizer] copied Sudachi dic to', dest);
      return dest;
    } catch (e) {
      console.warn('[japanese-tokenizer] ensureSudachiDictionary failed', e);
      return null;
    }
  }

  private sudachiDicCandidates(): string[] {
    const list: string[] = [];
    if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
      list.push(path.join(process.resourcesPath, 'sudachi', 'system_small.dic'));
    }
    // Dev: public/assets next to project / Angular serve root
    list.push(
      path.join(process.cwd(), 'public', 'assets', 'system_small.dic'),
      path.join(__dirname, '..', '..', '..', 'public', 'assets', 'system_small.dic'),
      path.join(__dirname, '..', '..', '..', '..', 'public', 'assets', 'system_small.dic'),
      path.join(app.getAppPath(), 'public', 'assets', 'system_small.dic')
    );
    return list;
  }

  private tokenizeSudachi(text: string): JapaneseToken[] {
    if (!this.sudachi) return [];
    const morphs = this.sudachi.tokenize(this.sudachiModeC, text) || [];
    return morphs.map(m => {
      const surface = m.surface();
      const reading = JapaneseCharacterUtil.readingToHiragana(m.readingForm() || '');
      return {
        surface,
        readingHiragana: reading,
        dictionaryForm: m.dictionaryForm() || surface,
        hasKanji: JapaneseCharacterUtil.containsKanji(surface)
      };
    });
  }

  private tokenizeKuromoji(text: string): JapaneseToken[] {
    if (!this.kuromoji) return [];
    const tokens = this.kuromoji.tokenize(text) || [];
    return tokens.map(t => {
      const surface = t.surface_form || '';
      const rawReading = t.reading || t.pronunciation || '';
      return {
        surface,
        readingHiragana: JapaneseCharacterUtil.readingToHiragana(rawReading),
        dictionaryForm: t.basic_form || surface,
        hasKanji: JapaneseCharacterUtil.containsKanji(surface)
      };
    });
  }

  private async loadKuromoji(): Promise<KuromojiTokenizer | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const kuromoji = require('kuromoji');
      const dictPath = this.resolveKuromojiDict();
      if (!dictPath || !fs.existsSync(dictPath)) {
        console.warn('[japanese-tokenizer] kuromoji dict not found', dictPath);
        return null;
      }
      return await new Promise(resolve => {
        kuromoji.builder({ dicPath: dictPath }).build((err: Error | null, tokenizer: KuromojiTokenizer) => {
          if (err || !tokenizer) {
            console.warn('[japanese-tokenizer] kuromoji load failed', err);
            resolve(null);
            return;
          }
          resolve(tokenizer);
        });
      });
    } catch (e) {
      console.warn('[japanese-tokenizer] kuromoji unavailable', e);
      return null;
    }
  }

  private resolveKuromojiDict(): string {
    const candidates: string[] = [];
    try {
      const pkgDir = path.dirname(require.resolve('kuromoji/package.json'));
      candidates.push(path.join(pkgDir, 'dict'));
      if (pkgDir.includes(`${path.sep}app.asar${path.sep}`) || pkgDir.includes('/app.asar/')) {
        candidates.unshift(
          pkgDir.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
        );
        candidates.unshift(pkgDir.replace('/app.asar/', '/app.asar.unpacked/'));
      }
    } catch { /* ignore */ }

    if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'kuromoji', 'dict'),
        path.join(process.resourcesPath, 'node_modules', 'kuromoji', 'dict')
      );
    }

    candidates.push(
      path.join(__dirname, '..', '..', '..', 'node_modules', 'kuromoji', 'dict'),
      path.join(__dirname, '..', '..', 'node_modules', 'kuromoji', 'dict'),
      path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict')
    );

    for (const c of candidates) {
      try {
        if (c && fs.existsSync(c) && fs.existsSync(path.join(c, 'base.dat.gz'))) {
          return c;
        }
      } catch { /* ignore */ }
    }
    return candidates.find(Boolean) || path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(s: string): string {
    return this.escapeHtml(s).replace(/'/g, '&#39;');
  }
}
