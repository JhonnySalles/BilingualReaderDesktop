import { ipcMain, dialog, clipboard, ClipboardItem, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../database/storage.service';
import { HistoryContentType, HistoryBookmarkEditInput } from '../database/history.repository';
import { ReadingTimeCalculatorService, RecalculateBatchOptions } from '../services/reading-time.service';
import { EpubBookExtractor } from '../parser/book/epub-book-extractor';
import { updateJumpListTasks } from '../main';

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

    ipcMain.handle(
      'history:listForSocialShare',
      async (
        _event,
        options: {
          startDate: string;
          endDate: string;
          type?: HistoryContentType | 'ALL';
          onlyCompleted?: boolean;
          libraryId?: number | null;
        }
      ) => {
        return this.storage.listHistoryForSocialShare(options);
      }
    );

    ipcMain.handle(
      'social:save-image',
      async (event, payload: { dataUrl?: string; dataUrls?: string[]; defaultName?: string }) => {
        try {
          const { dataUrl, dataUrls, defaultName = 'leitura-resumo.png' } = payload;
          const urls = dataUrls && dataUrls.length > 0 ? dataUrls : dataUrl ? [dataUrl] : [];
          if (urls.length === 0) {
            return { success: false, error: 'Nenhuma imagem para salvar.' };
          }

          const win = BrowserWindow.fromWebContents(event.sender);
          const dialogOpts = {
            title: urls.length > 1 ? `Salvar ${urls.length} Imagens de Compartilhamento` : 'Salvar Imagem de Compartilhamento',
            defaultPath: defaultName,
            filters: [{ name: 'Imagens PNG', extensions: ['png'] }]
          };
          const saveDialog = win
            ? await dialog.showSaveDialog(win, dialogOpts)
            : await dialog.showSaveDialog(dialogOpts);

          if (saveDialog.canceled || !saveDialog.filePath) {
            return { success: false, canceled: true };
          }

          if (urls.length === 1) {
            const base64Data = urls[0].replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.promises.writeFile(saveDialog.filePath, buffer);
            return { success: true, filePath: saveDialog.filePath };
          }

          const parsed = path.parse(saveDialog.filePath);
          const ext = parsed.ext || '.png';
          const savedPaths: string[] = [];

          for (let i = 0; i < urls.length; i++) {
            const pageFilePath = path.join(parsed.dir, `${parsed.name}-${i + 1}${ext}`);
            const base64Data = urls[i].replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            await fs.promises.writeFile(pageFilePath, buffer);
            savedPaths.push(pageFilePath);
          }

          return { success: true, filePath: savedPaths[0], filePaths: savedPaths };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
    );

    ipcMain.handle('social:copy-image', async (_event, payload: { dataUrl: string }) => {
      try {
        const base64Data = payload.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/png' });
        const item = new ClipboardItem({ 'image/png': blob });
        await clipboard.write([item]);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    });

    ipcMain.handle(
      'history:delete-by-reference',
      async (_event, fkReference: number, type: HistoryContentType) => {
        return this.storage.deleteHistoryByReference(fkReference, type);
      }
    );

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
        updateJumpListTasks();
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

        updateJumpListTasks();
        return true;
      }
    );
  }
}
