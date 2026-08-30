import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { StorageService } from './database/storage.service';
import { ScannerMangaService } from './scanner/scanner-manga.service';
import { SettingsController } from './controllers/settings.controller';

let mainWindow: BrowserWindow | null = null;
let storageService: StorageService;
let scannerMangaService: ScannerMangaService;

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
  storageService = new StorageService();
  scannerMangaService = new ScannerMangaService(storageService);
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

  ipcMain.handle('manga:list', async (_event, libraryId?: number) => {
    return storageService.listMangas(libraryId);
  });

  ipcMain.handle('manga:scan', async (_event, folderPath: string) => {
    scannerMangaService.scanFolder(folderPath, mainWindow);
    return true;
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
