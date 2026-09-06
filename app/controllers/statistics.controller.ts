import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { HistoryContentType } from '../database/history.repository';

export class StatisticsController {
  constructor(private storage: StorageService) {}

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
      async (_event, update: { id: number; pageEnd: number; pages?: number }) => {
        this.storage.updateHistorySession(update);
        return true;
      }
    );

    ipcMain.handle(
      'history:end',
      async (_event, payload: { id: number; pageEnd: number; pages?: number; type?: HistoryContentType; fkReference?: number }) => {
        this.storage.endHistorySession(payload.id, payload.pageEnd, payload.pages);

        if (payload.type && payload.fkReference != null) {
          const now = new Date().toISOString();
          if (payload.type === 'MANGA') {
            const manga = this.storage.findMangaById(payload.fkReference);
            if (manga) {
              this.storage.saveManga({
                ...manga,
                bookMark: payload.pageEnd,
                completed: payload.pages != null ? payload.pageEnd >= payload.pages : manga.completed,
                lastAccess: now,
                lastAlteration: now
              });
            }
          } else {
            const book = this.storage.findBookById(payload.fkReference);
            if (book) {
              this.storage.saveBook({
                ...book,
                bookMark: payload.pageEnd,
                completed: payload.pages != null ? payload.pageEnd >= payload.pages : book.completed,
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
