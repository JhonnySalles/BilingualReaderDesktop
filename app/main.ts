import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { StorageService } from './database/storage.service';
import { ScannerMangaService } from './scanner/scanner-manga.service';
import { ScannerBookService } from './scanner/scanner-book.service';
import { SettingsController } from './controllers/settings.controller';
import { MenuController } from './controllers/menu.controller';
import { SettingsService } from './services/settings.service';
import { StatisticsController } from './controllers/statistics.controller';
import { LibraryController } from './controllers/library.controller';
import { VocabularyController } from './controllers/vocabulary.controller';
import { MangaReaderController } from './controllers/manga-reader.controller';
import { BookReaderController } from './controllers/book-reader.controller';
import { FileLinkController } from './controllers/file-link.controller';
import { TrayService } from './services/tray.service';
import { ShareMarkController } from './controllers/sharemark.controller';
import { TtsController } from './controllers/tts.controller';
import { OcrController } from './controllers/ocr.controller';
import { LlmController } from './controllers/llm.controller';
import { AssistantController } from './controllers/assistant.controller';
import { JapaneseController } from './controllers/japanese.controller';
import { DatabaseMaintenanceController } from './controllers/database-maintenance.controller';
import { TrackerController } from './controllers/tracker.controller';
import { BookImageCoverController } from './controllers/book-image-cover.controller';
import { MangaImageCoverController } from './controllers/manga-image-cover.controller';
import { Telemetry } from './utils/telemetry';
import { getAppBaseDir, getAppDataDir, ensureAppDirs } from './utils/app-paths';

// Ensure data/cache directory structures and migrate legacy files
ensureAppDirs();

// Redirect userData path to data/userData inside executable folder or process.cwd()
if (app) {
  app.setPath('userData', path.join(getAppDataDir(), 'userData'));
}

// Init Sentry/Telemetry as early as possible (no-op when TELEMETRY_ENABLED=false).
Telemetry.init();

process.on('uncaughtException', (err) => {
  Telemetry.recordException(err, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  Telemetry.recordException(reason, 'unhandledRejection');
});

const LOCAL_SCHEME_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  bypassCSP: true,
  corsEnabled: true,
  stream: true
} as const;

// local-book must be privileged so epub.js can fetch() the EPUB from the renderer.
// Do NOT privilege local-cover: covers use local-cover:///{windowsPath} without a standard scheme.
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-book', privileges: { ...LOCAL_SCHEME_PRIVILEGES } }
]);

let mainWindow: BrowserWindow | null = null;
let storageService: StorageService;
let scannerMangaService: ScannerMangaService;
let scannerBookService: ScannerBookService;
let mangaReaderController: MangaReaderController;
let bookReaderController: BookReaderController;
let fileLinkController: FileLinkController;

function getWindowIconPath(): string {
  const candidates = [
    path.join(__dirname, '../assets/icons/icon.ico'),
    path.join(__dirname, 'assets/icons/icon.ico'),
    path.join(app.getAppPath(), 'app/assets/icons/icon.ico'),
    path.join(app.getAppPath(), 'public/assets/icons/icon.png'),
    path.join(app.getAppPath(), 'app/assets/icons/icon.png')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(app.getAppPath(), 'app/assets/icons/icon.ico');
}

function createWindow(): void {
  const iconPath = getWindowIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Bilingual Reader Desktop',
    icon: iconPath,
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
    const indexHtml = path.join(
      app.getAppPath(),
      'dist/bilingual-reader-desktop/browser/index.html'
    );
    if (!fs.existsSync(indexHtml)) {
      console.error('[main] index.html not found:', indexHtml);
    }
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[main] did-fail-load', { errorCode, errorDescription, validatedURL, indexHtml });
    });
    void mainWindow.loadFile(indexHtml);
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
    new VocabularyController(storageService).registerIpcHandlers();
    mangaReaderController = new MangaReaderController(storageService);
    mangaReaderController.registerIpcHandlers(() => mainWindow);
    bookReaderController = new BookReaderController(storageService);
    bookReaderController.registerIpcHandlers(() => mainWindow);
    fileLinkController = new FileLinkController(
      storageService,
      mangaReaderController.getSessionService()
    );
    fileLinkController.registerIpcHandlers(() => mainWindow);
    new ShareMarkController(storageService, () => mainWindow).registerIpcHandlers();
    new TtsController().registerIpcHandlers();
    new OcrController(mangaReaderController.getSessionService()).registerIpcHandlers();
    new LlmController().registerIpcHandlers();
    new AssistantController(
      storageService,
      () => mainWindow,
      mangaReaderController.getSessionService()
    ).registerIpcHandlers();
    new JapaneseController().registerIpcHandlers();
    new DatabaseMaintenanceController(storageService, () => mainWindow).registerIpcHandlers();
    new TrackerController(storageService).registerIpcHandlers();

    // Same pattern as local-cover — absolute path after scheme, no privileged registration
    let localPageServeLogged = false;
    protocol.handle('local-page', (request) => {
      try {
        const rawPath = request.url.replace(/^local-page:\/\//, '');
        let decodedPath = decodeURIComponent(rawPath.split('?')[0]);
        if (decodedPath.startsWith('/') && /^\/[A-Za-z]:/.test(decodedPath)) {
          decodedPath = decodedPath.slice(1);
        }
        const session = mangaReaderController.getSessionService();
        if (!decodedPath || !session.isPathAllowed(decodedPath)) {
          console.error('[local-page] forbidden path', decodedPath || request.url);
          return new Response('Forbidden', { status: 403 });
        }
        if (!localPageServeLogged) {
          localPageServeLogged = true;
          console.log('[local-page] serving', decodedPath);
        }
        return net.fetch('file:///' + decodedPath);
      } catch (err) {
        Telemetry.recordException(err, `[local-page] failed to serve ${request.url}`);
        return new Response('Not Found', { status: 404 });
      }
    });

    protocol.handle('local-book', (request) => {
      try {
        const parsed = new URL(request.url);
        const fromQuery = parsed.searchParams.get('p');
        let decodedPath = fromQuery ? decodeURIComponent(fromQuery) : '';

        if (!decodedPath) {
          const rawPath = request.url.replace(/^local-book:\/\//, '');
          decodedPath = decodeURIComponent(rawPath.split('?')[0]);
          if (decodedPath.startsWith('/') && /^\/[A-Za-z]:/.test(decodedPath)) {
            decodedPath = decodedPath.slice(1);
          }
        }

        const session = bookReaderController.getSessionService();
        if (!decodedPath || !session.isPathAllowed(decodedPath)) {
          console.error('[local-book] forbidden path', decodedPath || request.url);
          return new Response('Forbidden', { status: 403 });
        }
        return net.fetch(pathToFileURL(decodedPath).href);
      } catch (err) {
        Telemetry.recordException(err, `[local-book] failed to serve ${request.url}`);
        return new Response('Not Found', { status: 404 });
      }
    });

    createWindow();
    TrayService.instance.init(() => mainWindow);

    MenuController.instance.setServices(
      () => mainWindow,
      storageService,
      scannerMangaService,
      scannerBookService
    );
    MenuController.instance.buildMenu();

    ipcMain.handle('app:ping', async () => {
      return 'Pong de Electron Node.js!';
    });

    ipcMain.handle('fs:check-path-online', async (_event, folderPath: string) => {
      try {
        if (!folderPath) return false;
        return fs.existsSync(folderPath);
      } catch {
        return false;
      }
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

    ipcMain.handle('manga:scan', async (_event, folderPath: string, externalHd?: boolean) => {
      await scannerMangaService.scanFolder(folderPath, mainWindow, externalHd);
      return true;
    });

    ipcMain.handle('manga:cancel-scan', async () => {
      await scannerMangaService.stopScanning(mainWindow);
      return true;
    });

    ipcMain.handle('manga:get', async (_event, id: number) => {
      const manga = storageService.findMangaById(id) || null;
      if (!manga) return null;
      try {
        const coverPath = await MangaImageCoverController.instance.ensureCover(manga);
        if (coverPath && coverPath !== manga.coverPath) {
          storageService.saveManga({ ...manga, coverPath });
          return storageService.findMangaById(id) || { ...manga, coverPath };
        }
      } catch (e) {
        console.warn('[manga:get] ensureCover failed', id, e);
      }
      return manga;
    });

    ipcMain.handle('manga:clear-progress', async (_event, id: number) => {
      return storageService.clearMangaProgress(id) || null;
    });

    ipcMain.handle('book:get', async (_event, id: number) => {
      const book = storageService.findBookById(id) || null;
      if (!book) return null;
      try {
        const coverPath = BookImageCoverController.instance.ensureCover(book);
        if (coverPath && coverPath !== book.coverPath) {
          storageService.saveBook({ ...book, coverPath });
          return storageService.findBookById(id) || { ...book, coverPath };
        }
      } catch (e) {
        console.warn('[book:get] ensureCover failed', id, e);
      }
      return book;
    });

    ipcMain.handle('book:set-password', async (_event, id: number, password: string) => {
      return storageService.setBookPassword(id, password ?? '') || null;
    });

    ipcMain.handle('book:adjacent', async (_event, id: number) => {
      return storageService.getAdjacentBooks(id);
    });
    ipcMain.handle('manga:adjacent', async (_event, id: number) => {
      return storageService.getAdjacentMangas(id);
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

    ipcMain.handle('book:scan', async (_event, folderPath: string, externalHd?: boolean) => {
      await scannerBookService.scanFolder(folderPath, mainWindow, externalHd);
      return true;
    });

    ipcMain.handle('book:cancel-scan', async () => {
      await scannerBookService.stopScanning(mainWindow);
      return true;
    });

    ipcMain.handle('app:cancel-all-scans', async () => {
      await Promise.all([
        scannerMangaService.stopScanning(mainWindow),
        scannerBookService.stopScanning(mainWindow)
      ]);
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
    Telemetry.recordException(err, '[main] Failed during app ready / IPC registration');
  }
});

app.on('before-quit', () => {
  TrayService.instance.destroy();
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
