import { app, BrowserWindow, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import { SettingsService } from '../services/settings.service';
import { StorageService } from '../database/storage.service';
import { ScannerMangaService } from '../scanner/scanner-manga.service';
import { ScannerBookService } from '../scanner/scanner-book.service';

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
      title: 'Abrir Livro ou Mangá',
      properties: ['openFile'],
      filters: [
        {
          name: 'Todos os formatos suportados',
          extensions: [
            'cbz', 'cbr', 'cb7', 'cbt', 'zip', 'rar', '7z', 'tar',
            'epub', 'kepub', 'epub3', 'pdf', 'xps', 'mobi', 'azw', 'azw3', 'azw4',
            'fb2', 'txt'
          ]
        },
        {
          name: 'Mangás e Quadrinhos (*.cbz, *.cbr, *.zip, *.rar, ...)',
          extensions: ['cbz', 'cbr', 'cb7', 'cbt', 'zip', 'rar', '7z', 'tar']
        },
        {
          name: 'Livros Digitais (*.epub, *.pdf, *.mobi, ...)',
          extensions: ['epub', 'kepub', 'epub3', 'pdf', 'xps', 'mobi', 'azw', 'azw3', 'azw4', 'fb2', 'txt']
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
        label: 'Biblioteca de Mangás (Padrão)',
        click: () => this.navigate('/?lib=manga-default')
      },
      {
        label: 'Biblioteca de Livros (Padrão)',
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
        label: 'Arquivo',
        submenu: [
          {
            label: 'Abrir...',
            accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
            click: () => {
              void this.openFile();
            }
          }
        ]
      },
      {
        label: 'Início',
        click: () => this.navigate('/?lib=home')
      },
      {
        label: 'Biblioteca',
        submenu: librarySubmenu
      },
      {
        label: 'Histórico',
        click: () => this.navigate('/history')
      },
      {
        label: 'Vocabulário',
        click: () => this.navigate('/vocabulary')
      },
      {
        label: 'Estatísticas',
        click: () => this.navigate('/statistics')
      },
      {
        label: 'Configurações',
        click: () => this.navigate('/settings')
      },
      {
        label: 'Exibir',
        submenu: [
          { role: 'reload', label: 'Recarregar' },
          { role: 'forceReload', label: 'Forçar Recarregamento' },
          { role: 'toggleDevTools', label: 'Alternar Ferramentas de Desenvolvedor' },
          { type: 'separator' },
          { role: 'resetZoom', label: 'Tamanho Real' },
          { role: 'zoomIn', label: 'Aumentar Zoom' },
          { role: 'zoomOut', label: 'Diminuir Zoom' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Alternar Tela Cheia' }
        ]
      },
      {
        label: 'Sair',
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
