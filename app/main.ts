import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import { StorageService } from './database/storage.service';
import { ScannerMangaService } from './scanner/scanner-manga.service';
import { ScannerBookService } from './scanner/scanner-book.service';
import { SettingsController } from './controllers/settings.controller';

let mainWindow: BrowserWindow | null = null;
let storageService: StorageService;
let scannerMangaService: ScannerMangaService;
let scannerBookService: ScannerBookService;

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
  protocol.handle('local-cover', (request) => {
    const rawPath = request.url.replace(/^local-cover:\/\//, '');
    const decodedPath = decodeURIComponent(rawPath);
    return net.fetch('file:///' + decodedPath);
  });

  storageService = new StorageService();
  scannerMangaService = new ScannerMangaService(storageService);
  scannerBookService = new ScannerBookService(storageService);
  SettingsController.instance.registerIpcHandlers();

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
    if (typeof libIdOrPath === 'string' && libIdOrPath.includes('/') || (typeof libIdOrPath === 'string' && libIdOrPath.includes('\\'))) {
      targetLibraryId = storageService.getOrCreateLibrary(libIdOrPath, type);
    } else {
      const numId = typeof libIdOrPath === 'number' ? libIdOrPath : parseInt(libIdOrPath, 10);
      if (!isNaN(numId) && numId > 0) {
        targetLibraryId = numId;
      } else {
        targetLibraryId = undefined; // Count all/default items if -1 or -2 or undefined
      }
    }

    if (type === 'BOOK') {
      return storageService.countBooks(targetLibraryId);
    }
    return storageService.countMangas(targetLibraryId);
  });
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
