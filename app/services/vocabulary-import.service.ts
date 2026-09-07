import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { StorageService } from '../database/storage.service';
import { ParseFactory } from '../parser/manga/parse-factory';
import { SettingsService } from './settings.service';
import { GeneralConsts } from '../utils/constants';
import {
  normalizeVocabularyWire,
  VocabularyWire
} from '../../src/app/core/models/entities/subtitle.model';
import { Vocabulary } from '../database/vocabulary.repository';
import { EBookConverterService } from './ebook-converter.service';

export interface VocabularyImportResult {
  ok: boolean;
  skipped?: boolean;
  linked: number;
  message?: string;
}

type KuromojiTokenizer = {
  tokenize: (text: string) => Array<{
    surface_form: string;
    basic_form: string;
    reading?: string;
    pos?: string;
  }>;
};

export class VocabularyImportService {
  private tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;

  constructor(private storage: StorageService) {}

  public async importManga(mangaId: number, forced = false): Promise<VocabularyImportResult> {
    const manga = this.storage.findMangaById(mangaId);
    if (!manga?.path) {
      return { ok: false, linked: 0, message: 'Mangá não encontrado' };
    }

    if (!forced && manga.lastVocabImport) {
      const fileMtime = this.safeMtime(manga.path);
      const last = Date.parse(manga.lastVocabImport);
      if (fileMtime && last && fileMtime <= last) {
        return {
          ok: true,
          skipped: true,
          linked: 0,
          message: 'Vocabulário já importado para este arquivo'
        };
      }
    }

    const parser = await ParseFactory.create(manga.path);
    if (!parser) {
      return { ok: false, linked: 0, message: 'Não foi possível abrir o arquivo do mangá' };
    }

    try {
      if (!parser.hasSubtitles()) {
        return { ok: false, linked: 0, message: 'Este mangá não possui legendas JSON' };
      }

      const counts = new Map<string, { vocab: Vocabulary; appears: number }>();
      for (const raw of parser.getSubtitles()) {
        this.collectFromSubtitleJson(raw, counts);
      }

      if (counts.size === 0) {
        return {
          ok: false,
          linked: 0,
          message: 'Nenhum vocabulário japonês encontrado nas legendas'
        };
      }

      if (forced) {
        this.storage.vocabularyRepository.clearMangaLinks(mangaId);
      }

      let linked = 0;
      for (const item of counts.values()) {
        const saved = this.storage.vocabularyRepository.upsert(item.vocab);
        if (!saved.id) continue;
        this.storage.vocabularyRepository.linkManga(mangaId, saved.id, Math.max(1, item.appears));
        linked++;
      }

      this.storage.saveManga({
        id: mangaId,
        lastVocabImport: new Date().toISOString(),
        fileAlteration: manga.fileAlteration
      });

      return { ok: true, linked, message: `${linked} palavras vinculadas` };
    } catch (e: any) {
      console.error('[vocabulary-import] manga failed', e);
      return { ok: false, linked: 0, message: e?.message || 'Falha ao importar vocabulário' };
    } finally {
      try {
        parser.destroy();
      } catch { /* ignore */ }
    }
  }

  public async importBook(bookId: number, forced = false): Promise<VocabularyImportResult> {
    const book = this.storage.findBookById(bookId);
    if (!book?.path) {
      return { ok: false, linked: 0, message: 'Livro não encontrado' };
    }

    if (!forced && book.lastVocabImport) {
      const fileMtime = this.safeMtime(book.path);
      const last = Date.parse(book.lastVocabImport);
      if (fileMtime && last && fileMtime <= last) {
        return {
          ok: true,
          skipped: true,
          linked: 0,
          message: 'Vocabulário já importado para este arquivo'
        };
      }
    }

    try {
      const epubPath = await EBookConverterService.instance.convertToEpub(book.path);
      const textChunks = this.extractEpubText(epubPath);
      if (!textChunks.length) {
        return { ok: false, linked: 0, message: 'Não foi possível extrair texto do livro' };
      }

      const tokenizer = await this.getTokenizer();
      const counts = new Map<string, { vocab: Vocabulary; appears: number }>();

      if (tokenizer) {
        for (const chunk of textChunks) {
          for (const token of tokenizer.tokenize(chunk)) {
            const surface = (token.surface_form || '').trim();
            const basic = (token.basic_form || surface).trim();
            if (!surface || basic === '*') continue;
            if (!this.isJapaneseWord(surface)) continue;
            const pos = token.pos || '';
            if (pos.startsWith('助詞') || pos.startsWith('助動詞') || pos.startsWith('記号')) continue;
            const key = `${surface}\0${basic}`;
            const existing = counts.get(key);
            if (existing) {
              existing.appears += 1;
            } else {
              counts.set(key, {
                appears: 1,
                vocab: {
                  word: surface,
                  basicForm: basic,
                  reading: token.reading || '',
                  english: '',
                  portuguese: '',
                  jlpt: '',
                  revised: false,
                  favorite: false,
                  appears: 0
                }
              });
            }
          }
        }
      } else {
        // Fallback: match dictionary entries that appear in text
        this.matchDictionaryInText(textChunks.join('\n'), counts);
      }

      if (counts.size === 0) {
        return { ok: false, linked: 0, message: 'Nenhuma palavra encontrada no livro' };
      }

      if (forced) {
        this.storage.vocabularyRepository.clearBookLinks(bookId);
      }

      let linked = 0;
      for (const item of counts.values()) {
        // Prefer linking known dictionary entries; upsert creates thin stubs when missing
        const known =
          this.storage.vocabularyRepository.findByWordAndBasicForm(item.vocab.word, item.vocab.basicForm) ||
          this.storage.vocabularyRepository.findByWord(item.vocab.word);
        const saved = known
          ? known
          : this.storage.vocabularyRepository.upsert(item.vocab);
        if (!saved.id) continue;
        this.storage.vocabularyRepository.linkBook(bookId, saved.id, item.appears);
        linked++;
      }

      this.storage.saveBook({
        id: bookId,
        lastVocabImport: new Date().toISOString(),
        fileAlteration: book.fileAlteration
      });

      return { ok: true, linked, message: `${linked} palavras vinculadas` };
    } catch (e: any) {
      console.error('[vocabulary-import] book failed', e);
      return { ok: false, linked: 0, message: e?.message || 'Falha ao importar vocabulário' };
    }
  }

  public shouldAutoProcessManga(): boolean {
    return !!SettingsService.instance.get(
      GeneralConsts.KEYS.READER.MANGA_PROCESS_VOCABULARY,
      true
    );
  }

  public shouldAutoProcessBook(): boolean {
    return !!SettingsService.instance.get(
      GeneralConsts.KEYS.READER.BOOK_PROCESS_VOCABULARY,
      true
    );
  }

  private collectFromSubtitleJson(
    raw: string,
    counts: Map<string, { vocab: Vocabulary; appears: number }>
  ): void {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const chapters = this.extractJapaneseChapters(data);
    for (const chapter of chapters) {
      const chapterVocabs = this.readVocabList(chapter.vocabularios);
      for (const v of chapterVocabs) {
        this.bumpCount(counts, v, 0);
      }

      const pages = chapter.paginas || chapter.pages || [];
      for (const page of pages) {
        const pageVocabs = this.readVocabList(page.vocabularios);
        for (const v of pageVocabs) {
          this.bumpCount(counts, v, 1);
        }
      }

      // Ensure chapter-only entries still get appears >= 1
      for (const v of chapterVocabs) {
        const key = this.vocabKey(v);
        const entry = counts.get(key);
        if (entry && entry.appears < 1) entry.appears = 1;
      }
    }
  }

  private extractJapaneseChapters(data: any): any[] {
    if (!data || typeof data !== 'object') return [];

    const isJapanese = (lang: any) => {
      const s = String(lang || '').toUpperCase();
      return s === 'JAPANESE' || s === 'JA' || s === 'JP' || s.includes('JAPAN');
    };

    // Volume wrapper
    if (Array.isArray(data.capitulos) || Array.isArray(data.chapters)) {
      const chapters = data.capitulos || data.chapters || [];
      const lang = data.lingua || data.language;
      return chapters.filter((ch: any) => isJapanese(ch?.lingua || ch?.language || lang));
    }

    // Single chapter
    if (data.vocabularios || data.paginas || data.pages) {
      if (isJapanese(data.lingua || data.language)) return [data];
      return [];
    }

    // Array of chapters
    if (Array.isArray(data)) {
      return data.filter((ch: any) => isJapanese(ch?.lingua || ch?.language));
    }

    return [];
  }

  private readVocabList(list: any): Vocabulary[] {
    if (!Array.isArray(list) && !(list instanceof Set)) return [];
    const arr = Array.isArray(list) ? list : Array.from(list);
    const out: Vocabulary[] = [];
    for (const item of arr) {
      const n = normalizeVocabularyWire(item as VocabularyWire);
      if (!n) continue;
      out.push({
        word: n.word,
        basicForm: n.basicForm || n.word,
        reading: n.reading || '',
        english: n.english || '',
        portuguese: n.portuguese || '',
        jlpt: n.jlpt || '',
        revised: !!n.revised,
        favorite: !!n.favorite,
        appears: n.appears || 0
      });
    }
    return out;
  }

  private bumpCount(
    counts: Map<string, { vocab: Vocabulary; appears: number }>,
    vocab: Vocabulary,
    delta: number
  ): void {
    const key = this.vocabKey(vocab);
    const existing = counts.get(key);
    if (existing) {
      existing.appears += delta;
      // Prefer richer metadata
      if (!existing.vocab.portuguese && vocab.portuguese) existing.vocab.portuguese = vocab.portuguese;
      if (!existing.vocab.english && vocab.english) existing.vocab.english = vocab.english;
      if (!existing.vocab.reading && vocab.reading) existing.vocab.reading = vocab.reading;
    } else {
      counts.set(key, { vocab: { ...vocab }, appears: Math.max(0, delta) });
    }
  }

  private vocabKey(v: Vocabulary): string {
    return `${v.word}\0${v.basicForm || v.word}`;
  }

  private extractEpubText(epubPath: string): string[] {
    if (!fs.existsSync(epubPath)) return [];
    try {
      const zip = new AdmZip(epubPath);
      const entries = zip.getEntries().filter(e => {
        if (e.isDirectory) return false;
        const name = e.entryName.toLowerCase();
        return name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm');
      });
      entries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
      const chunks: string[] = [];
      for (const entry of entries) {
        const html = zip.readAsText(entry);
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (text) chunks.push(text);
      }
      return chunks;
    } catch (e) {
      console.warn('[vocabulary-import] epub extract failed', e);
      return [];
    }
  }

  private matchDictionaryInText(
    text: string,
    counts: Map<string, { vocab: Vocabulary; appears: number }>
  ): void {
    // Limit scan to words that appear as substrings — sample by length buckets for performance
    const candidates = this.storage.vocabularyRepository.list().filter(v =>
      v.word && v.word.length >= 2 && /[\u3040-\u30ff\u4e00-\u9faf]/.test(v.word)
    );
    // Prefer longer matches first; cap work
    candidates.sort((a, b) => (b.word?.length || 0) - (a.word?.length || 0));
    const maxCheck = Math.min(candidates.length, 8000);
    for (let i = 0; i < maxCheck; i++) {
      const v = candidates[i];
      let idx = 0;
      let appears = 0;
      while (appears < 50) {
        const found = text.indexOf(v.word, idx);
        if (found < 0) break;
        appears++;
        idx = found + v.word.length;
      }
      if (appears > 0) {
        counts.set(this.vocabKey(v), { vocab: v, appears });
      }
    }
  }

  private async getTokenizer(): Promise<KuromojiTokenizer | null> {
    if (!this.tokenizerPromise) {
      this.tokenizerPromise = this.loadKuromoji();
    }
    return this.tokenizerPromise;
  }

  private async loadKuromoji(): Promise<KuromojiTokenizer | null> {
    try {
      // Dynamic require so missing dep doesn't crash boot
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const kuromoji = require('kuromoji');
      const dictPath = this.resolveKuromojiDict();
      if (!dictPath || !fs.existsSync(dictPath)) {
        console.warn('[vocabulary-import] kuromoji dict not found', dictPath);
        return null;
      }
      console.log('[vocabulary-import] loading kuromoji dict from', dictPath);
      return await new Promise((resolve) => {
        kuromoji.builder({ dicPath: dictPath }).build((err: Error | null, tokenizer: KuromojiTokenizer) => {
          if (err || !tokenizer) {
            console.warn('[vocabulary-import] kuromoji load failed', err, 'dict=', dictPath);
            resolve(null);
            return;
          }
          console.log('[vocabulary-import] kuromoji ready');
          resolve(tokenizer);
        });
      });
    } catch (e) {
      console.warn('[vocabulary-import] kuromoji unavailable', e);
      return null;
    }
  }

  /**
   * Resolve kuromoji IPADIC dict folder for:
   * - yarn/npm install (require.resolve)
   * - tsc output under dist-electron/app/services
   * - packaged Electron with asarUnpack → app.asar.unpacked/node_modules/kuromoji/dict
   */
  private resolveKuromojiDict(): string {
    const candidates: string[] = [];

    try {
      const pkgDir = path.dirname(require.resolve('kuromoji/package.json'));
      candidates.push(path.join(pkgDir, 'dict'));
      // If resolve landed inside app.asar, prefer the unpacked sibling
      if (pkgDir.includes(`${path.sep}app.asar${path.sep}`) || pkgDir.includes('/app.asar/')) {
        candidates.unshift(
          pkgDir.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
        );
        candidates.unshift(pkgDir.replace('/app.asar/', '/app.asar.unpacked/'));
      }
    } catch { /* package not resolvable */ }

    if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'kuromoji', 'dict'),
        path.join(process.resourcesPath, 'node_modules', 'kuromoji', 'dict')
      );
    }

    // dist-electron/app/services → project root (3 levels up)
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

  private isJapaneseWord(text: string): boolean {
    return /[\u3040-\u30ff\u4e00-\u9faf]/.test(text) && text.length > 0;
  }

  private safeMtime(filePath: string): number | null {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
  }
}
