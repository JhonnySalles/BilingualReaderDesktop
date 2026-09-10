import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../database/storage.service';
import { MangaImageCoverController } from './manga-image-cover.controller';
import { BookImageCoverController } from './book-image-cover.controller';
import { GeneralConsts } from '../utils/constants';

function formatBackupStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Matches intent of BACKUP_DATE_PATTERN: yyyy-MM-dd_HH-mm-ss
  void GeneralConsts.PATTERNS.BACKUP_DATE_PATTERN;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function clearDirContents(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        fs.rmSync(full, { recursive: true, force: true });
      } else {
        fs.unlinkSync(full);
      }
      removed += 1;
    } catch (e) {
      console.warn('[covers:clear-cache] failed to remove', full, e);
    }
  }
  return removed;
}

export class DatabaseMaintenanceController {
  constructor(
    private storage: StorageService,
    private getWindow: () => BrowserWindow | null
  ) {}

  registerIpcHandlers(): void {
    ipcMain.handle('db:backup', async () => {
      const win = this.getWindow();
      if (!win) return { ok: false, canceled: true };

      this.storage.checkpointWal();
      const dbPath = this.storage.getDbPath();
      if (!fs.existsSync(dbPath)) {
        return { ok: false, error: 'Arquivo do banco não encontrado' };
      }

      const result = await dialog.showSaveDialog(win, {
        title: 'Salvar backup do banco de dados',
        defaultPath: path.join(
          app.getPath('documents'),
          `BilingualReaderDesktop_${formatBackupStamp()}.db`
        ),
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });
      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      const dest = result.filePath.endsWith('.db') ? result.filePath : `${result.filePath}.db`;
      fs.copyFileSync(dbPath, dest);
      for (const suffix of ['-wal', '-shm']) {
        const side = `${dbPath}${suffix}`;
        if (fs.existsSync(side)) {
          try {
            fs.copyFileSync(side, `${dest}${suffix}`);
          } catch {
            /* ignore side-car copy errors after checkpoint */
          }
        }
      }
      return { ok: true, path: dest };
    });

    ipcMain.handle('db:restore', async () => {
      const win = this.getWindow();
      if (!win) return { ok: false, canceled: true };

      const result = await dialog.showOpenDialog(win, {
        title: 'Restaurar backup do banco de dados',
        properties: ['openFile'],
        filters: [
          { name: 'SQLite Database', extensions: ['db'] },
          { name: 'Todos os arquivos', extensions: ['*'] }
        ]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const source = result.filePaths[0];
      if (!fs.existsSync(source)) {
        return { ok: false, error: 'Arquivo de backup não encontrado' };
      }

      const dbPath = this.storage.getDbPath();
      this.storage.closeDatabase();

      try {
        for (const suffix of ['', '-wal', '-shm']) {
          const target = `${dbPath}${suffix}`;
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
          }
        }
        fs.copyFileSync(source, dbPath);
        for (const suffix of ['-wal', '-shm']) {
          const side = `${source}${suffix}`;
          if (fs.existsSync(side)) {
            fs.copyFileSync(side, `${dbPath}${suffix}`);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: false, error: message };
      }

      app.relaunch();
      app.exit(0);
      return { ok: true, relaunching: true };
    });

    ipcMain.handle('covers:clear-cache', async () => {
      const mangaDir = (MangaImageCoverController.instance as any).getCacheDir?.() as string | undefined;
      const bookDir = (BookImageCoverController.instance as any).getCacheDir?.() as string | undefined;
      // Prefer public clear methods
      const mangaRemoved = MangaImageCoverController.instance.clearCache();
      const bookRemoved = BookImageCoverController.instance.clearCache();
      void mangaDir;
      void bookDir;
      return { ok: true, mangaRemoved, bookRemoved };
    });

    ipcMain.handle('statistics:clear-history', async () => {
      const removed = this.storage.clearHistory();
      return { ok: true, removed };
    });

    ipcMain.handle('app:get-info', async () => {
      return {
        name: app.getName(),
        version: app.getVersion(),
        author: 'Jhonny Salles',
        productName: 'Bilingual Reader'
      };
    });
  }
}
