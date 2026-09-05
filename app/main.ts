import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { StorageService } from './database/storage.service';
import { ScannerMangaService } from './scanner/scanner-manga.service';
import { ScannerBookService } from './scanner/scanner-book.service';
import { SettingsController } from './controllers/settings.controller';
import { SettingsService } from './services/settings.service';
import { StatisticsController } from './controllers/statistics.controller';
import { LibraryController } from './controllers/library.controller';
import { MangaReaderController } from './controllers/manga-reader.controller';

const LOCAL_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  bypassCSP: true,
  corsEnabled: true,
  stream: true
} as const;

// Must run before app ready so <img src="local-page://..."> works from http://localhost.
// Do NOT privilege local-cover: covers already use local-cover:///{windowsPath} and worked
// without a standard scheme; privileging it breaks path parsing (ERR_FILE_NOT_FOUND).
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-page', privileges: { ...LOCAL_SCHEME_PRIVILEGES } }
]);

let mainWindow: BrowserWindow | null = null;
let storageService: StorageService;
let scannerMangaService: ScannerMangaService;
let scannerBookService: ScannerBookService;
let mangaReaderController: MangaReaderController;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bilingual Reader Desktop',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/bilingual-reader-desktop/browser/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  try {
    // Keep the original cover handler — renderer uses local-cover:///{absoluteWindowsPath}
    protocol.handle('local-cover', (request) => {
      const rawPath = request.url.replace(/^local-cover:\/\//, '');
      const decodedPath = decodeURIComponent(rawPath);
      return net.fetch('file:///' + decodedPath);
    });

    storageService = new StorageService();
    scannerMangaService = new ScannerMangaService(storageService);
    scannerBookService = new ScannerBookService(storageService);
    SettingsController.instance.registerIpcHandlers();
    new StatisticsController(storageService).registerIpcHandlers();
    new LibraryController(storageService).registerIpcHandlers();
    mangaReaderController = new MangaReaderController(storageService);
    mangaReaderController.registerIpcHandlers(() => mainWindow);

    protocol.handle('local-page', (request) => {
      try {
        const parsed = new URL(request.url);
        const fromQuery = parsed.searchParams.get('p');
        let decodedPath = fromQuery ? decodeURIComponent(fromQuery) : '';

        if (!decodedPath) {
          // Legacy fallback: local-page:///encoded/path
          const rawPath = request.url.replace(/^local-page:\/\//, '');
          decodedPath = decodeURIComponent(rawPath.split('?')[0]);
          if (decodedPath.startsWith('/') && /^\/[A-Za-z]:/.test(decodedPath)) {
            decodedPath = decodedPath.slice(1);
          }
        }

        const session = mangaReaderController.getSessionService();
        if (!decodedPath || !session.isPathAllowed(decodedPath)) {
          console.error('[local-page] forbidden path', decodedPath || request.url);
          return new Response('Forbidden', { status: 403 });
        }
        return net.fetch(pathToFileURL(decodedPath).href);
      } catch (err) {
        console.error('[local-page] failed to serve', request.url, err);
        return new Response('Not Found', { status: 404 });
      }
    });

    createWindow();

    ipcMain.handle('app:ping', async () => {
      return 'Pong de Electron Node.js!';
    });

    ipcMain.handle('dialog:openDirectory', async () => {
      if (!mainWindow) return null;
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Diretório de Biblioteca',
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    });

    ipcMain.handle('manga:list', async (_event, folderPath?: string) => {
      let libraryId: number | undefined;
      if (folderPath) {
        libraryId = storageService.getOrCreateLibrary(folderPath, 'MANGA');
      }
      return storageService.listMangas(libraryId);
    });

    ipcMain.handle('manga:scan', async (_event, folderPath: string) => {
      await scannerMangaService.scanFolder(folderPath, mainWindow);
      return true;
    });

    ipcMain.handle('manga:get', async (_event, id: number) => {
      return storageService.findMangaById(id) || null;
    });

    ipcMain.handle('manga:clear-progress', async (_event, id: number) => {
      return storageService.clearMangaProgress(id) || null;
    });

    ipcMain.handle('book:get', async (_event, id: number) => {
      return storageService.findBookById(id) || null;
    });

    ipcMain.handle('book:clear-progress', async (_event, id: number) => {
      return storageService.clearBookProgress(id) || null;
    });

    ipcMain.handle('book:list', async (_event, folderPath?: string) => {
      let libraryId: number | undefined;
      if (folderPath) {
        libraryId = storageService.getOrCreateLibrary(folderPath, 'BOOK');
      }
      return storageService.listBooks(libraryId);
    });

    ipcMain.handle('book:scan', async (_event, folderPath: string) => {
      await scannerBookService.scanFolder(folderPath, mainWindow);
      return true;
    });

    ipcMain.handle('library:get-count', async (_event, libIdOrPath: string | number, type: 'MANGA' | 'BOOK') => {
      let targetLibraryId: number | undefined;

      if (typeof libIdOrPath === 'string' && (libIdOrPath.includes('/') || libIdOrPath.includes('\\'))) {
        targetLibraryId = storageService.getOrCreateLibrary(libIdOrPath, type);
      } else {
        const numId = typeof libIdOrPath === 'number' ? libIdOrPath : parseInt(libIdOrPath, 10);
        if (!isNaN(numId) && numId > 0) {
          targetLibraryId = numId;
        } else {
          // Reserved/Default library IDs (e.g. -1 or -2) or unspecified path
          const defaultPathKey = type === 'MANGA' ? 'mangaBasePath' : 'bookBasePath';
          const fallbackPath = type === 'MANGA'
            ? 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas'
            : 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books';
          const folderPath = SettingsService.instance.get(defaultPathKey, fallbackPath);
          targetLibraryId = storageService.getOrCreateLibrary(folderPath, type);
        }
      }

      if (type === 'BOOK') {
        return storageService.countBooks(targetLibraryId);
      }
      return storageService.countMangas(targetLibraryId);
    });
  } catch (err) {
    console.error('[main] Failed during app ready / IPC registration:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
