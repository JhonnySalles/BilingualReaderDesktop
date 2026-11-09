import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { SettingsService } from '../services/settings.service';
import { StorageService } from '../database/storage.service';
import { ScannerMangaService } from '../scanner/scanner-manga.service';
import { ScannerBookService } from '../scanner/scanner-book.service';
import { t } from '../i18n';

const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar']);

export class MenuController {
  private static _instance: MenuController;
  private getWindow: (() => BrowserWindow | null) | null = null;
  private storageService: StorageService | null = null;
  private scannerMangaService: ScannerMangaService | null = null;
  private scannerBookService: ScannerBookService | null = null;

  public static get instance(): MenuController {
    if (!this._instance) {
      this._instance = new MenuController();
    }
    return this._instance;
  }

  public setServices(
    getWindow: () => BrowserWindow | null,
    storage: StorageService,
    scannerManga: ScannerMangaService,
    scannerBook: ScannerBookService
  ): void {
    this.getWindow = getWindow;
    this.storageService = storage;
    this.scannerMangaService = scannerManga;
    this.scannerBookService = scannerBook;
  }

  private navigate(routePath: string): void {
    const win = this.getWindow ? this.getWindow() : BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('app:navigate', routePath);
    }
  }

  public async openFile(): Promise<void> {
    const win = this.getWindow ? this.getWindow() : BrowserWindow.getFocusedWindow();
    if (!win) return;

    const result = await dialog.showOpenDialog(win, {
      title: t('openFileTitle'),
      properties: ['openFile'],
      filters: [
        {
          name: 'Todos os formatos suportados',
          extensions: [
            'cbz', 'cbr', 'cb7', 'cbt', 'zip', 'rar', '7z', 'tar',
            'epub', 'kepub', 'epub3', 'pdf', 'xps', 'mobi', 'azw', 'azw3', 'azw4',
            'pdb', 'prc', 'djvu', 'fb2', 'txt', 'txtz', 'rtf', 'html', 'htm', 'htmlz', 'doc', 'docx',
            'odt', 'md', 'markdown', 'mht', 'mhtml', 'lit', 'lrf', 'rb', 'snb', 'tcr', 'tif', 'tiff'
          ]
        },
        {
          name: 'Mangás e Quadrinhos (*.cbz, *.cbr, *.zip, *.rar, ...)',
          extensions: ['cbz', 'cbr', 'cb7', 'cbt', 'zip', 'rar', '7z', 'tar']
        },
        {
          name: 'Livros Digitais (*.epub, *.pdf, *.mobi, ...)',
          extensions: [
            'epub',
            'kepub',
            'epub3',
            'pdf',
            'xps',
            'mobi',
            'azw',
            'azw3',
            'azw4',
            'pdb',
            'prc',
            'djvu',
            'fb2',
            'txt',
            'txtz',
            'rtf',
            'html',
            'htm',
            'htmlz',
            'xhtml',
            'doc',
            'docx',
            'odt',
            'md',
            'markdown',
            'mht',
            'mhtml',
            'lit',
            'lrf',
            'rb',
            'snb',
            'tcr',
            'tif',
            'tiff'
          ]
        },
        {
          name: 'Todos os arquivos',
          extensions: ['*']
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();

    if (MANGA_EXTENSIONS.has(ext)) {
      let manga = this.storageService?.findMangaByPath(filePath);
      if (!manga && this.scannerMangaService) {
        manga = (await this.scannerMangaService.processSingleFile(filePath, win)) || undefined;
      }
      if (manga?.id) {
        this.navigate(`/reader-image/${manga.id}`);
      }
    } else {
      let book = this.storageService?.findBookByPath(filePath);
      if (!book && this.scannerBookService) {
        book = (await this.scannerBookService.processSingleFile(filePath, win)) || undefined;
      }
      if (book?.id) {
        this.navigate(`/reader-text/${book.id}`);
      }
    }
  }

  public buildMenu(): void {
    const customLibraries: Array<{ id: string; title: string; type: string }> =
      SettingsService.instance.get('libraries', []);

    const librarySubmenu: MenuItemConstructorOptions[] = [
      {
        label: t('mangaLibraryDefault'),
        click: () => this.navigate('/?lib=manga-default')
      },
      {
        label: t('bookLibraryDefault'),
        click: () => this.navigate('/?lib=book-default')
      }
    ];

    if (customLibraries && customLibraries.length > 0) {
      librarySubmenu.push({ type: 'separator' });
      for (const lib of customLibraries) {
        const icon = lib.type === 'manga' ? '🎨' : '📚';
        librarySubmenu.push({
          label: `${icon} ${lib.title}`,
          click: () => this.navigate(`/?lib=${lib.id}`)
        });
      }
    }

    const template: MenuItemConstructorOptions[] = [
      {
        label: t('file'),
        submenu: [
          {
            label: t('open'),
            accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
            click: () => {
              void this.openFile();
            }
          }
        ]
      },
      {
        label: t('home'),
        click: () => this.navigate('/?lib=home')
      },
      {
        label: t('library'),
        submenu: librarySubmenu
      },
      {
        label: t('history'),
        click: () => this.navigate('/history')
      },
      {
        label: t('vocabulary'),
        click: () => this.navigate('/vocabulary')
      },
      {
        label: t('statistics'),
        click: () => this.navigate('/statistics')
      },
      {
        label: t('settings'),
        click: () => this.navigate('/settings')
      },
      {
        label: t('help'),
        click: () => this.navigate('/help')
      },
      {
        label: t('about'),
        click: () => this.navigate('/about')
      },
      {
        label: t('view'),
        submenu: [
          { role: 'reload', label: t('reload') },
          { role: 'forceReload', label: t('forceReload') },
          { role: 'toggleDevTools', label: t('toggleDevTools') },
          { type: 'separator' },
          { role: 'resetZoom', label: t('resetZoom') },
          { role: 'zoomIn', label: t('zoomIn') },
          { role: 'zoomOut', label: t('zoomOut') },
          { type: 'separator' },
          { role: 'togglefullscreen', label: t('togglefullscreen') }
        ]
      },
      {
        label: t('exit'),
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
        click: () => {
          app.quit();
        }
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}
