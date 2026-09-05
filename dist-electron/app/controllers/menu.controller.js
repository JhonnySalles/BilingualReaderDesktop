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
exports.MenuController = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const settings_service_1 = require("../services/settings.service");
const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar']);
class MenuController {
    static _instance;
    getWindow = null;
    storageService = null;
    scannerMangaService = null;
    scannerBookService = null;
    static get instance() {
        if (!this._instance) {
            this._instance = new MenuController();
        }
        return this._instance;
    }
    setServices(getWindow, storage, scannerManga, scannerBook) {
        this.getWindow = getWindow;
        this.storageService = storage;
        this.scannerMangaService = scannerManga;
        this.scannerBookService = scannerBook;
    }
    navigate(routePath) {
        const win = this.getWindow ? this.getWindow() : electron_1.BrowserWindow.getFocusedWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('app:navigate', routePath);
        }
    }
    async openFile() {
        const win = this.getWindow ? this.getWindow() : electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return;
        const result = await electron_1.dialog.showOpenDialog(win, {
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
        }
        else {
            let book = this.storageService?.findBookByPath(filePath);
            if (!book && this.scannerBookService) {
                book = (await this.scannerBookService.processSingleFile(filePath, win)) || undefined;
            }
            if (book?.id) {
                this.navigate(`/reader-text/${book.id}`);
            }
        }
    }
    buildMenu() {
        const customLibraries = settings_service_1.SettingsService.instance.get('libraries', []);
        const librarySubmenu = [
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
        const template = [
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
                    electron_1.app.quit();
                }
            }
        ];
        const menu = electron_1.Menu.buildFromTemplate(template);
        electron_1.Menu.setApplicationMenu(menu);
    }
}
exports.MenuController = MenuController;
