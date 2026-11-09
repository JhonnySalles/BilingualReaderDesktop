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
const i18n_1 = require("../i18n");
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
            title: (0, i18n_1.t)('openFileTitle'),
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
                label: (0, i18n_1.t)('mangaLibraryDefault'),
                click: () => this.navigate('/?lib=manga-default')
            },
            {
                label: (0, i18n_1.t)('bookLibraryDefault'),
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
                label: (0, i18n_1.t)('file'),
                submenu: [
                    {
                        label: (0, i18n_1.t)('open'),
                        accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
                        click: () => {
                            void this.openFile();
                        }
                    }
                ]
            },
            {
                label: (0, i18n_1.t)('home'),
                click: () => this.navigate('/?lib=home')
            },
            {
                label: (0, i18n_1.t)('library'),
                submenu: librarySubmenu
            },
            {
                label: (0, i18n_1.t)('history'),
                click: () => this.navigate('/history')
            },
            {
                label: (0, i18n_1.t)('vocabulary'),
                click: () => this.navigate('/vocabulary')
            },
            {
                label: (0, i18n_1.t)('statistics'),
                click: () => this.navigate('/statistics')
            },
            {
                label: (0, i18n_1.t)('settings'),
                click: () => this.navigate('/settings')
            },
            {
                label: (0, i18n_1.t)('help'),
                click: () => this.navigate('/help')
            },
            {
                label: (0, i18n_1.t)('about'),
                click: () => this.navigate('/about')
            },
            {
                label: (0, i18n_1.t)('view'),
                submenu: [
                    { role: 'reload', label: (0, i18n_1.t)('reload') },
                    { role: 'forceReload', label: (0, i18n_1.t)('forceReload') },
                    { role: 'toggleDevTools', label: (0, i18n_1.t)('toggleDevTools') },
                    { type: 'separator' },
                    { role: 'resetZoom', label: (0, i18n_1.t)('resetZoom') },
                    { role: 'zoomIn', label: (0, i18n_1.t)('zoomIn') },
                    { role: 'zoomOut', label: (0, i18n_1.t)('zoomOut') },
                    { type: 'separator' },
                    { role: 'togglefullscreen', label: (0, i18n_1.t)('togglefullscreen') }
                ]
            },
            {
                label: (0, i18n_1.t)('exit'),
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
