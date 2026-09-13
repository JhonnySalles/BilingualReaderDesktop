"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const url_1 = require("url");
const storage_service_1 = require("./database/storage.service");
const scanner_manga_service_1 = require("./scanner/scanner-manga.service");
const scanner_book_service_1 = require("./scanner/scanner-book.service");
const settings_controller_1 = require("./controllers/settings.controller");
const menu_controller_1 = require("./controllers/menu.controller");
const settings_service_1 = require("./services/settings.service");
const statistics_controller_1 = require("./controllers/statistics.controller");
const library_controller_1 = require("./controllers/library.controller");
const vocabulary_controller_1 = require("./controllers/vocabulary.controller");
const manga_reader_controller_1 = require("./controllers/manga-reader.controller");
const book_reader_controller_1 = require("./controllers/book-reader.controller");
const file_link_controller_1 = require("./controllers/file-link.controller");
const tray_service_1 = require("./services/tray.service");
const sharemark_controller_1 = require("./controllers/sharemark.controller");
const tts_controller_1 = require("./controllers/tts.controller");
const ocr_controller_1 = require("./controllers/ocr.controller");
const llm_controller_1 = require("./controllers/llm.controller");
const assistant_controller_1 = require("./controllers/assistant.controller");
const japanese_controller_1 = require("./controllers/japanese.controller");
const database_maintenance_controller_1 = require("./controllers/database-maintenance.controller");
const tracker_controller_1 = require("./controllers/tracker.controller");
const book_image_cover_controller_1 = require("./controllers/book-image-cover.controller");
const manga_image_cover_controller_1 = require("./controllers/manga-image-cover.controller");
const telemetry_1 = require("./utils/telemetry");
const app_paths_1 = require("./utils/app-paths");
// Ensure data/cache directory structures and migrate legacy files
(0, app_paths_1.ensureAppDirs)();
// Redirect userData path to data/userData inside executable folder or process.cwd()
if (electron_1.app) {
    electron_1.app.setPath('userData', path.join((0, app_paths_1.getAppDataDir)(), 'userData'));
}
// Init Sentry/Telemetry as early as possible (no-op when TELEMETRY_ENABLED=false).
telemetry_1.Telemetry.init();
process.on('uncaughtException', (err) => {
    telemetry_1.Telemetry.recordException(err, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    telemetry_1.Telemetry.recordException(reason, 'unhandledRejection');
});
const LOCAL_SCHEME_PRIVILEGES = {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    bypassCSP: true,
    corsEnabled: true,
    stream: true
};
// local-book must be privileged so epub.js can fetch() the EPUB from the renderer.
// Do NOT privilege local-cover: covers use local-cover:///{windowsPath} without a standard scheme.
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'local-book', privileges: { ...LOCAL_SCHEME_PRIVILEGES } }
]);
let mainWindow = null;
let storageService;
let scannerMangaService;
let scannerBookService;
let mangaReaderController;
let bookReaderController;
let fileLinkController;
function getWindowIconPath() {
    const candidates = [
        path.join(__dirname, '../assets/icons/icon.ico'),
        path.join(__dirname, 'assets/icons/icon.ico'),
        path.join(electron_1.app.getAppPath(), 'app/assets/icons/icon.ico'),
        path.join(electron_1.app.getAppPath(), 'public/assets/icons/icon.png'),
        path.join(electron_1.app.getAppPath(), 'app/assets/icons/icon.png')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return path.join(electron_1.app.getAppPath(), 'app/assets/icons/icon.ico');
}
function createWindow() {
    const iconPath = getWindowIconPath();
    mainWindow = new electron_1.BrowserWindow({
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
    const isDev = process.env['NODE_ENV'] === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    }
    else {
        const indexHtml = path.join(electron_1.app.getAppPath(), 'dist/bilingual-reader-desktop/browser/index.html');
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
electron_1.app.on('ready', () => {
    try {
        // Keep the original cover handler — renderer uses local-cover:///{absoluteWindowsPath}
        electron_1.protocol.handle('local-cover', (request) => {
            const rawPath = request.url.replace(/^local-cover:\/\//, '');
            const decodedPath = decodeURIComponent(rawPath);
            return electron_1.net.fetch('file:///' + decodedPath);
        });
        storageService = new storage_service_1.StorageService();
        scannerMangaService = new scanner_manga_service_1.ScannerMangaService(storageService);
        scannerBookService = new scanner_book_service_1.ScannerBookService(storageService);
        settings_controller_1.SettingsController.instance.registerIpcHandlers();
        new statistics_controller_1.StatisticsController(storageService).registerIpcHandlers();
        new library_controller_1.LibraryController(storageService).registerIpcHandlers();
        new vocabulary_controller_1.VocabularyController(storageService).registerIpcHandlers();
        mangaReaderController = new manga_reader_controller_1.MangaReaderController(storageService);
        mangaReaderController.registerIpcHandlers(() => mainWindow);
        bookReaderController = new book_reader_controller_1.BookReaderController(storageService);
        bookReaderController.registerIpcHandlers(() => mainWindow);
        fileLinkController = new file_link_controller_1.FileLinkController(storageService, mangaReaderController.getSessionService());
        fileLinkController.registerIpcHandlers(() => mainWindow);
        new sharemark_controller_1.ShareMarkController(storageService, () => mainWindow).registerIpcHandlers();
        new tts_controller_1.TtsController().registerIpcHandlers();
        new ocr_controller_1.OcrController(mangaReaderController.getSessionService()).registerIpcHandlers();
        new llm_controller_1.LlmController().registerIpcHandlers();
        new assistant_controller_1.AssistantController(storageService, () => mainWindow, mangaReaderController.getSessionService()).registerIpcHandlers();
        new japanese_controller_1.JapaneseController().registerIpcHandlers();
        new database_maintenance_controller_1.DatabaseMaintenanceController(storageService, () => mainWindow).registerIpcHandlers();
        new tracker_controller_1.TrackerController(storageService).registerIpcHandlers();
        // Same pattern as local-cover — absolute path after scheme, no privileged registration
        let localPageServeLogged = false;
        electron_1.protocol.handle('local-page', (request) => {
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
                return electron_1.net.fetch('file:///' + decodedPath);
            }
            catch (err) {
                telemetry_1.Telemetry.recordException(err, `[local-page] failed to serve ${request.url}`);
                return new Response('Not Found', { status: 404 });
            }
        });
        electron_1.protocol.handle('local-book', (request) => {
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
                return electron_1.net.fetch((0, url_1.pathToFileURL)(decodedPath).href);
            }
            catch (err) {
                telemetry_1.Telemetry.recordException(err, `[local-book] failed to serve ${request.url}`);
                return new Response('Not Found', { status: 404 });
            }
        });
        createWindow();
        tray_service_1.TrayService.instance.init(() => mainWindow);
        menu_controller_1.MenuController.instance.setServices(() => mainWindow, storageService, scannerMangaService, scannerBookService);
        menu_controller_1.MenuController.instance.buildMenu();
        electron_1.ipcMain.handle('app:ping', async () => {
            return 'Pong de Electron Node.js!';
        });
        electron_1.ipcMain.handle('fs:check-path-online', async (_event, folderPath) => {
            try {
                if (!folderPath)
                    return false;
                return fs.existsSync(folderPath);
            }
            catch {
                return false;
            }
        });
        electron_1.ipcMain.handle('dialog:openDirectory', async () => {
            if (!mainWindow)
                return null;
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                title: 'Selecionar Diretório de Biblioteca',
                properties: ['openDirectory', 'createDirectory']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            return result.filePaths[0];
        });
        electron_1.ipcMain.handle('manga:list', async (_event, folderPath) => {
            let libraryId;
            if (folderPath) {
                libraryId = storageService.getOrCreateLibrary(folderPath, 'MANGA');
            }
            return storageService.listMangas(libraryId);
        });
        electron_1.ipcMain.handle('manga:scan', async (_event, folderPath, externalHd) => {
            await scannerMangaService.scanFolder(folderPath, mainWindow, externalHd);
            return true;
        });
        electron_1.ipcMain.handle('manga:cancel-scan', async () => {
            await scannerMangaService.stopScanning(mainWindow);
            return true;
        });
        electron_1.ipcMain.handle('manga:get', async (_event, id) => {
            const manga = storageService.findMangaById(id) || null;
            if (!manga)
                return null;
            try {
                const coverPath = await manga_image_cover_controller_1.MangaImageCoverController.instance.ensureCover(manga);
                if (coverPath && coverPath !== manga.coverPath) {
                    storageService.saveManga({ ...manga, coverPath });
                    return storageService.findMangaById(id) || { ...manga, coverPath };
                }
            }
            catch (e) {
                console.warn('[manga:get] ensureCover failed', id, e);
            }
            return manga;
        });
        electron_1.ipcMain.handle('manga:clear-progress', async (_event, id) => {
            return storageService.clearMangaProgress(id) || null;
        });
        electron_1.ipcMain.handle('book:get', async (_event, id) => {
            const book = storageService.findBookById(id) || null;
            if (!book)
                return null;
            try {
                const coverPath = book_image_cover_controller_1.BookImageCoverController.instance.ensureCover(book);
                if (coverPath && coverPath !== book.coverPath) {
                    storageService.saveBook({ ...book, coverPath });
                    return storageService.findBookById(id) || { ...book, coverPath };
                }
            }
            catch (e) {
                console.warn('[book:get] ensureCover failed', id, e);
            }
            return book;
        });
        electron_1.ipcMain.handle('book:set-password', async (_event, id, password) => {
            return storageService.setBookPassword(id, password ?? '') || null;
        });
        electron_1.ipcMain.handle('book:adjacent', async (_event, id) => {
            return storageService.getAdjacentBooks(id);
        });
        electron_1.ipcMain.handle('manga:adjacent', async (_event, id) => {
            return storageService.getAdjacentMangas(id);
        });
        electron_1.ipcMain.handle('book:clear-progress', async (_event, id) => {
            return storageService.clearBookProgress(id) || null;
        });
        electron_1.ipcMain.handle('book:list', async (_event, folderPath) => {
            let libraryId;
            if (folderPath) {
                libraryId = storageService.getOrCreateLibrary(folderPath, 'BOOK');
            }
            return storageService.listBooks(libraryId);
        });
        electron_1.ipcMain.handle('book:scan', async (_event, folderPath, externalHd) => {
            await scannerBookService.scanFolder(folderPath, mainWindow, externalHd);
            return true;
        });
        electron_1.ipcMain.handle('book:cancel-scan', async () => {
            await scannerBookService.stopScanning(mainWindow);
            return true;
        });
        electron_1.ipcMain.handle('app:cancel-all-scans', async () => {
            await Promise.all([
                scannerMangaService.stopScanning(mainWindow),
                scannerBookService.stopScanning(mainWindow)
            ]);
            return true;
        });
        electron_1.ipcMain.handle('library:get-count', async (_event, libIdOrPath, type) => {
            let targetLibraryId;
            if (typeof libIdOrPath === 'string' && (libIdOrPath.includes('/') || libIdOrPath.includes('\\'))) {
                targetLibraryId = storageService.getOrCreateLibrary(libIdOrPath, type);
            }
            else {
                const numId = typeof libIdOrPath === 'number' ? libIdOrPath : parseInt(libIdOrPath, 10);
                if (!isNaN(numId) && numId > 0) {
                    targetLibraryId = numId;
                }
                else {
                    const defaultPathKey = type === 'MANGA' ? 'mangaBasePath' : 'bookBasePath';
                    const fallbackPath = type === 'MANGA'
                        ? 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas'
                        : 'C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books';
                    const folderPath = settings_service_1.SettingsService.instance.get(defaultPathKey, fallbackPath);
                    targetLibraryId = storageService.getOrCreateLibrary(folderPath, type);
                }
            }
            if (type === 'BOOK') {
                return storageService.countBooks(targetLibraryId);
            }
            return storageService.countMangas(targetLibraryId);
        });
    }
    catch (err) {
        telemetry_1.Telemetry.recordException(err, '[main] Failed during app ready / IPC registration');
    }
});
electron_1.app.on('before-quit', () => {
    tray_service_1.TrayService.instance.destroy();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
