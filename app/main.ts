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
import { LlmServerController } from './controllers/llm-server.controller';
import { LlmDownloaderController } from './controllers/llm-downloader.controller';
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
// Do NOT privilege local-cover with 'standard: true': covers use local-cover:///{windowsPath} without a standard scheme.
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-book', privileges: { ...LOCAL_SCHEME_PRIVILEGES } },
  { scheme: 'local-cover', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, stream: true } }
]);

let mainWindow: BrowserWindow | null = null;
let storageService: StorageService;
let scannerMangaService: ScannerMangaService;
let scannerBookService: ScannerBookService;
let mangaReaderController: MangaReaderController;
let bookReaderController: BookReaderController;
let fileLinkController: FileLinkController;
let lastOpenedDirectory: string | undefined;

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

const gotTheLock = app.requestSingleInstanceLock();

function getRouteFromArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg === '--open-library') {
      return '/';
    }
    const libMatch = arg.match(/^--open-library=(.+)$/);
    if (libMatch) {
      return `/?lib=${libMatch[1]}`;
    }
    const mangaMatch = arg.match(/^--open-manga=(\d+)$/);
    if (mangaMatch) {
      return `/detail/manga/${mangaMatch[1]}`;
    }
    const bookMatch = arg.match(/^--open-book=(\d+)$/);
    if (bookMatch) {
      return `/detail/book/${bookMatch[1]}`;
    }
  }
  return null;
}

export function updateJumpListTasks(): void {
  try {
    if (process.platform !== 'win32' || !storageService) return;

    const rawIconPath = getWindowIconPath();
    const iconPath = fs.existsSync(rawIconPath) && rawIconPath.endsWith('.ico')
      ? rawIconPath
      : process.execPath;

    const tasks: Electron.Task[] = [
      {
        program: process.execPath,
        arguments: '--open-library=manga-default',
        iconPath: iconPath,
        iconIndex: 0,
        title: 'Biblioteca de Mangás',
        description: 'Abrir a Biblioteca de Mangás Padrão'
      },
      {
        program: process.execPath,
        arguments: '--open-library=book-default',
        iconPath: iconPath,
        iconIndex: 0,
        title: 'Biblioteca de Livros',
        description: 'Abrir a Biblioteca de Livros Padrão'
      }
    ];

    try {
      const allLibs = storageService.listAllLibraries();
      for (const lib of allLibs) {
        tasks.push({
          program: process.execPath,
          arguments: `--open-library=${lib.id}`,
          iconPath: iconPath,
          iconIndex: 0,
          title: lib.title,
          description: `Biblioteca: ${lib.title} (${lib.type === 'MANGA' ? 'Mangá' : 'Livro'})`
        });
      }
    } catch (libErr) {
      console.warn('[main] Failed to list custom libraries for jump list', libErr);
    }

    try {
      const recentReads = storageService.listRecentReads(3);
      for (const item of recentReads) {
        const isManga = item.type === 'MANGA';
        const arg = isManga ? `--open-manga=${item.fkReference}` : `--open-book=${item.fkReference}`;
        tasks.push({
          program: process.execPath,
          arguments: arg,
          iconPath: iconPath,
          iconIndex: 0,
          title: item.title,
          description: `Continuar ${isManga ? 'Mangá' : 'Livro'}`
        });
      }
    } catch (recentErr) {
      console.warn('[main] Failed to list recent reads for jump list', recentErr);
    }

    app.setUserTasks(tasks);
  } catch (err) {
    console.warn('[main] Failed to update user tasks (jump list)', err);
  }
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const route = getRouteFromArgv(commandLine);
      if (route) {
        mainWindow.webContents.send('app:navigate', route);
      }
    }
  });
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

  mainWindow.webContents.on('did-finish-load', () => {
    const route = getRouteFromArgv(process.argv);
    if (route && mainWindow) {
      mainWindow.webContents.send('app:navigate', route);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  try {
    // Keep the original cover handler — renderer uses local-cover:///{absoluteWindowsPath}
    protocol.handle('local-cover', (request) => {
      try {
        const rawPath = request.url.replace(/^local-cover:\/*/, '');
        let decodedPath = decodeURIComponent(rawPath.split('?')[0]);
        if (decodedPath.startsWith('/') && /^\/[A-Za-z]:/.test(decodedPath)) {
          decodedPath = decodedPath.slice(1);
        }
        decodedPath = path.normalize(decodedPath);
        if (!fs.existsSync(decodedPath)) {
          return new Response('Not Found', { status: 404 });
        }
        
        let contentType = 'image/png';
        if (decodedPath.toLowerCase().endsWith('.jpg') || decodedPath.toLowerCase().endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (decodedPath.toLowerCase().endsWith('.webp')) {
          contentType = 'image/webp';
        }

        const data = fs.readFileSync(decodedPath);
        return new Response(data, {
          headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        Telemetry.recordException(err, `[local-cover] failed to serve ${request.url}`);
        return new Response('Not Found', { status: 404 });
      }
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
    LlmServerController.instance.registerIpcHandlers();
    LlmDownloaderController.instance.setWindowGetter(() => mainWindow);
    LlmDownloaderController.instance.registerIpcHandlers();
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
        
        let contentType = 'image/png';
        if (decodedPath.toLowerCase().endsWith('.jpg') || decodedPath.toLowerCase().endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (decodedPath.toLowerCase().endsWith('.webp')) {
          contentType = 'image/webp';
        } else if (decodedPath.toLowerCase().endsWith('.gif')) {
          contentType = 'image/gif';
        }

        const data = fs.readFileSync(decodedPath);
        return new Response(data, {
          headers: { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' }
        });
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

    /**
     * Capture a DIP-space rectangle of the requesting webContents as a PNG data URL.
     * Rect is relative to the webContents viewport (getBoundingClientRect coords).
     * Uses event.sender so DevTools focus does not break capture.
     */
    try {
      ipcMain.removeHandler('window:capture-rect');
    } catch {
      /* ignore — first registration */
    }
    ipcMain.handle(
      'window:capture-rect',
      async (
        event,
        rect: { x: number; y: number; width: number; height: number }
      ): Promise<string | null> => {
        try {
          const sender = event.sender;
          if (!sender || sender.isDestroyed()) return null;
          const x = Math.max(0, Math.floor(rect?.x ?? 0));
          const y = Math.max(0, Math.floor(rect?.y ?? 0));
          const width = Math.max(1, Math.floor(rect?.width ?? 0));
          const height = Math.max(1, Math.floor(rect?.height ?? 0));
          if (width < 2 || height < 2) return null;

          if (!sender.debugger.isAttached()) {
            try {
              sender.debugger.attach('1.3');
            } catch {
              /* ignore */
            }
          }

          if (sender.debugger.isAttached()) {
            try {
              const res = await sender.debugger.sendCommand('Page.captureScreenshot', {
                format: 'png',
                clip: { x, y, width, height, scale: 1 },
                captureBeyondViewport: true
              });
              if (res?.data) {
                return `data:image/png;base64,${res.data}`;
              }
            } catch (cdpErr) {
              console.warn('[window:capture-rect] cdp screenshot failed, falling back', cdpErr);
            }
          }

          const image = await sender.capturePage({ x, y, width, height });
          if (image.isEmpty()) return null;
          return image.toDataURL();
        } catch (e) {
          console.warn('[window:capture-rect] failed', e);
          return null;
        }
      }
    );
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
        defaultPath: lastOpenedDirectory,
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      lastOpenedDirectory = result.filePaths[0];
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

    ipcMain.handle('app:update-jump-list', async () => {
      updateJumpListTasks();
      return true;
    });

    updateJumpListTasks();
  } catch (err) {
    Telemetry.recordException(err, '[main] Failed during app ready / IPC registration');
  }
});

app.on('before-quit', () => {
  LlmServerController.instance.stopServer();
  TrayService.instance.destroy();
});

app.on('window-all-closed', () => {
  LlmServerController.instance.stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
