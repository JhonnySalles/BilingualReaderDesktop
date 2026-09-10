import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { Vocabulary, VocabularySearchOptions } from '../database/vocabulary.repository';
import { VocabularyImportService } from '../services/vocabulary-import.service';
import { JapaneseTokenizerService } from '../services/japanese-tokenizer.service';

export interface VocabularyLookupOptions {
  text: string;
  mangaId?: number | null;
  bookId?: number | null;
}

export class VocabularyController {
  private importer: VocabularyImportService;
  private tokenizer = JapaneseTokenizerService.getInstance();

  constructor(private storage: StorageService) {
    this.importer = new VocabularyImportService(storage);
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('vocabulary:search', async (_event, options: VocabularySearchOptions) => {
      return this.storage.searchVocabulary(options || {});
    });

    ipcMain.handle('vocabulary:get', async (_event, id: number) => {
      return this.storage.getVocabulary(id) ?? null;
    });

    ipcMain.handle('vocabulary:setFavorite', async (_event, id: number, favorite: boolean) => {
      return this.storage.setVocabularyFavorite(id, !!favorite) ?? null;
    });

    ipcMain.handle(
      'vocabulary:related',
      async (_event, vocabularyId: number, titleHint?: string | null) => {
        return this.storage.getVocabularyRelated(vocabularyId, titleHint);
      }
    );

    ipcMain.handle('vocabulary:lookup', async (_event, options: VocabularyLookupOptions) => {
      return this.lookupVocabulary(options || { text: '' });
    });

    ipcMain.handle('kanjax:get', async (_event, kanji: string) => {
      return this.storage.getKanjax(kanji);
    });

    ipcMain.handle('kanjax:forWord', async (_event, word: string) => {
      return this.storage.getKanjaxForWord(word || '');
    });

    ipcMain.handle('vocabulary:importManga', async (_event, mangaId: number, forced = true) => {
      return this.importer.importManga(mangaId, forced !== false);
    });

    ipcMain.handle('vocabulary:importBook', async (_event, bookId: number, forced = true) => {
      return this.importer.importBook(bookId, forced !== false);
    });
  }

  private async lookupVocabulary(options: VocabularyLookupOptions): Promise<Vocabulary | null> {
    const text = String(options?.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;

    const mangaId = options.mangaId ?? null;
    const bookId = options.bookId ?? null;
    const repo = this.storage.vocabularyRepository;

    const tryExact = (word: string, basic?: string): Vocabulary | undefined => {
      const w = word.trim();
      if (!w) return undefined;
      if (basic != null && basic.trim()) {
        const both = repo.findByWordAndBasicForm(w, basic.trim());
        if (both) return both;
      }
      return repo.findByWord(w);
    };

    let hit = tryExact(text);
    if (hit) return hit;

    try {
      const tokens = await this.tokenizer.tokenize(text);
      for (const t of tokens) {
        hit = tryExact(t.surface, t.dictionaryForm);
        if (hit) return hit;
        if (t.dictionaryForm && t.dictionaryForm !== t.surface) {
          hit = tryExact(t.dictionaryForm);
          if (hit) return hit;
        }
      }
    } catch (e) {
      console.warn('[vocabulary] tokenize during lookup failed', e);
    }

    const page = repo.searchPage({
      query: text,
      mangaId,
      bookId,
      limit: 1,
      offset: 0,
      order: 'appears',
      desc: true
    });
    return page.items[0] ?? null;
  }
}
