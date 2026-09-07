import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { StorageService } from '../database/storage.service';
import { MangaReaderSessionService, OpenMangaReaderResult } from '../services/manga-reader-session.service';
import { LinkedFile } from '../../src/app/core/models/entities/linked-file.model';
import { Languages } from '../../src/app/core/models/enums/app-enums';

export class FileLinkController {
  constructor(
    private storage: StorageService,
    private sessionService: MangaReaderSessionService
  ) {}

  registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
    ipcMain.handle('file-link:get', async (_event, mangaId: number) => {
      if (!mangaId) return null;
      return this.storage.getFileLinkByManga(mangaId) || null;
    });

    ipcMain.handle('file-link:find', async (_event, mangaId: number, name: string, pages: number) => {
      if (!mangaId || !name) return null;
      return this.storage.findFileLinkByName(mangaId, name, pages) || null;
    });

    ipcMain.handle('file-link:save', async (_event, file: LinkedFile) => {
      if (!file?.idManga) return null;
      file.lastAccess = new Date().toISOString();
      if (!file.language) file.language = Languages.PORTUGUESE;
      const id = this.storage.saveFileLink(file);
      return this.storage.getFileLinkByManga(file.idManga) || { ...file, id };
    });

    ipcMain.handle('file-link:delete', async (_event, mangaId: number) => {
      if (!mangaId) return false;
      this.storage.deleteFileLinkByManga(mangaId);
      return true;
    });

    ipcMain.handle('file-link:open-file', async (_event, filePath: string, mangaId = 0) => {
      if (!filePath) throw new Error('Caminho do arquivo não informado');
      const opened = await this.sessionService.openByPath(filePath, mangaId || 0, getWindow());
      return this.toOpenPayload(opened);
    });

    ipcMain.handle('file-link:close-file', async (_event, sessionId: string) => {
      if (!sessionId) return false;
      return this.sessionService.close(sessionId);
    });

    ipcMain.handle('dialog:openMangaFile', async () => {
      const win = getWindow();
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        title: 'Selecionar arquivo de mangá',
        properties: ['openFile'],
        filters: [
          {
            name: 'Mangá / Comic',
            extensions: ['cbz', 'cbr', 'zip', 'rar', '7z', 'cb7', 'cbt', 'tar']
          },
          { name: 'Todos', extensions: ['*'] }
        ]
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });
  }

  private toOpenPayload(opened: OpenMangaReaderResult) {
    const ext = path.extname(opened.path).replace(/^\./, '').toLowerCase();
    return {
      sessionId: opened.sessionId,
      path: opened.path,
      name: path.basename(opened.path),
      type: ext || 'dir',
      folder: path.dirname(opened.path),
      pageCount: opened.pageCount,
      pages: opened.pages,
      pageNames: opened.pageNames,
      pagePaths: opened.pagePaths,
      chapters: opened.chapters,
      chaptersPages: opened.chaptersPages || {},
      cacheDir: opened.cacheDir
    };
  }
}
