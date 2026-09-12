import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { HistoryContentType, HistoryBookmarkEditInput } from '../database/history.repository';
import { ReadingTimeCalculatorService, RecalculateBatchOptions } from '../services/reading-time.service';
import { EpubBookExtractor } from '../parser/book/epub-book-extractor';

export class StatisticsController {
  private readingTimeService: ReadingTimeCalculatorService;

  constructor(private storage: StorageService) {
    this.readingTimeService = new ReadingTimeCalculatorService(this.storage);
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('statistics:get', async () => {
      return this.storage.getStatisticsOverview();
    });

    ipcMain.handle(
      'statistics:chart',
      async (_event, type: HistoryContentType, year: number, libraryId?: number | null) => {
        return this.storage.getStatisticsChart(type, year, libraryId ?? null);
      }
    );

    ipcMain.handle('statistics:years', async (_event, type: HistoryContentType) => {
      return this.storage.listStatisticsYears(type);
    });

    ipcMain.handle('libraries:listByType', async (_event, type: HistoryContentType) => {
      return this.storage.listLibrariesByType(type);
    });

    ipcMain.handle(
      'history:listAggregated',
      async (
        _event,
        options: {
          type: HistoryContentType;
          year?: number | null;
          libraryId?: number | null;
          search?: string | null;
        }
      ) => {
        return this.storage.listHistoryAggregated(options);
      }
    );

    ipcMain.handle('history:listRecent', async (_event, limit?: number) => {
      return this.storage.listRecentReads(limit ?? 3);
    });

    ipcMain.handle('statistics:heatmap', async (_event, _weeks?: number) => {
      return this.storage.getReadingActivityHeatmap();
    });

    ipcMain.handle(
      'history:saveBookmarkEdit',
      async (
        _event,
        input: HistoryBookmarkEditInput
      ) => {
        return this.storage.saveHistoryBookmarkEdit(input);
      }
    );

    ipcMain.handle(
      'history:countBookWords',
      async (_event, filePath: string, pageStart?: number, pageEnd?: number) => {
        return EpubBookExtractor.countWords(filePath, pageStart, pageEnd);
      }
    );

    ipcMain.handle(
      'history:recalculateBatch',
      async (event, options: {
        type: 'MANGA' | 'BOOK';
        onlyNew: boolean;
        avgTimePerPage: number;
        avgTimePerWord: number;
      }) => {
        return this.readingTimeService.recalculateBatch({
          ...options,
          onProgress: (prog) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('history:recalculateProgress', prog);
            }
          }
        });
      }
    );

    ipcMain.handle(
      'history:start',
      async (
        _event,
        input: {
          fkLibrary: number;
          fkReference: number;
          type: HistoryContentType;
          pageStart: number;
          pages: number;
          volume?: string;
        }
      ) => {
        const sessionId = this.storage.startHistorySession(input);
        const now = new Date().toISOString();
        if (input.type === 'MANGA') {
          const manga = this.storage.findMangaById(input.fkReference);
          if (manga) {
            this.storage.saveManga({
              ...manga,
              lastAccess: now,
              lastAlteration: now
            });
          }
        } else {
          const book = this.storage.findBookById(input.fkReference);
          if (book) {
            this.storage.saveBook({
              ...book,
              lastAccess: now,
              lastAlteration: now
            });
          }
        }
        return sessionId;
      }
    );

    ipcMain.handle(
      'history:update',
      async (_event, update: { id: number; pageEnd: number; pages?: number; useTTS?: boolean }) => {
        this.storage.updateHistorySession(update);
        return true;
      }
    );

    ipcMain.handle(
      'history:end',
      async (_event, payload: {
        id: number;
        pageEnd: number;
        pages?: number;
        type?: HistoryContentType;
        fkReference?: number;
        useTTS?: boolean;
      }) => {
        this.storage.endHistorySession(payload.id, payload.pageEnd, payload.pages, payload.useTTS);

        if (payload.type && payload.fkReference != null) {
          const now = new Date().toISOString();
          if (payload.type === 'MANGA') {
            const manga = this.storage.findMangaById(payload.fkReference);
            if (manga) {
              const pages = Math.max(1, payload.pages ?? manga.pages ?? 1);
              const bookMark = Math.min(Math.max(0, Math.floor(payload.pageEnd)), pages);
              this.storage.saveManga({
                ...manga,
                bookMark,
                completed: bookMark >= pages,
                lastAccess: now,
                lastAlteration: now
              });
            }
          } else {
            const book = this.storage.findBookById(payload.fkReference);
            if (book) {
              const pages = Math.max(1, payload.pages ?? book.pages ?? 1);
              const bookMark = Math.min(Math.max(0, Math.floor(payload.pageEnd)), pages);
              this.storage.saveBook({
                ...book,
                bookMark,
                completed: bookMark >= pages,
                lastAccess: now,
                lastAlteration: now
              });
            }
          }
        }

        return true;
      }
    );
  }
}
