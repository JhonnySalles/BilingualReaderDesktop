import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { VocabularySearchOptions } from '../database/vocabulary.repository';
import { VocabularyImportService } from '../services/vocabulary-import.service';

export class VocabularyController {
  private importer: VocabularyImportService;

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
}
