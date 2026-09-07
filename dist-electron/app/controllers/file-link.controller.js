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
exports.FileLinkController = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
class FileLinkController {
    storage;
    sessionService;
    constructor(storage, sessionService) {
        this.storage = storage;
        this.sessionService = sessionService;
    }
    registerIpcHandlers(getWindow) {
        electron_1.ipcMain.handle('file-link:get', async (_event, mangaId) => {
            if (!mangaId)
                return null;
            return this.storage.getFileLinkByManga(mangaId) || null;
        });
        electron_1.ipcMain.handle('file-link:find', async (_event, mangaId, name, pages) => {
            if (!mangaId || !name)
                return null;
            return this.storage.findFileLinkByName(mangaId, name, pages) || null;
        });
        electron_1.ipcMain.handle('file-link:save', async (_event, file) => {
            if (!file?.idManga)
                return null;
            file.lastAccess = new Date().toISOString();
            if (!file.language)
                file.language = app_enums_1.Languages.PORTUGUESE;
            const id = this.storage.saveFileLink(file);
            return this.storage.getFileLinkByManga(file.idManga) || { ...file, id };
        });
        electron_1.ipcMain.handle('file-link:delete', async (_event, mangaId) => {
            if (!mangaId)
                return false;
            this.storage.deleteFileLinkByManga(mangaId);
            return true;
        });
        electron_1.ipcMain.handle('file-link:open-file', async (_event, filePath, mangaId = 0) => {
            if (!filePath)
                throw new Error('Caminho do arquivo não informado');
            const opened = await this.sessionService.openByPath(filePath, mangaId || 0, getWindow());
            return this.toOpenPayload(opened);
        });
        electron_1.ipcMain.handle('file-link:close-file', async (_event, sessionId) => {
            if (!sessionId)
                return false;
            return this.sessionService.close(sessionId);
        });
        electron_1.ipcMain.handle('dialog:openMangaFile', async () => {
            const win = getWindow();
            if (!win)
                return null;
            const result = await electron_1.dialog.showOpenDialog(win, {
                title: 'Selecionar arquivo de mangá',
                properties: ['openFile'],
                filters: [
                    {
                        name: 'Mangá / Comic',
                        extensions: ['cbz', 'cbr', 'zip', 'rar', '7z', 'cb7', 'cbt', 'tar']
                    },
                    { name: 'Todos', extensions: ['*'] }
                ]
            });
            if (result.canceled || result.filePaths.length === 0)
                return null;
            return result.filePaths[0];
        });
    }
    toOpenPayload(opened) {
        const ext = path.extname(opened.path).replace(/^\./, '').toLowerCase();
        return {
            sessionId: opened.sessionId,
            path: opened.path,
            name: path.basename(opened.path),
            type: ext || 'dir',
            folder: path.dirname(opened.path),
            pageCount: opened.pageCount,
            pages: opened.pages,
            pageNames: opened.pageNames,
            pagePaths: opened.pagePaths,
            chapters: opened.chapters,
            chaptersPages: opened.chaptersPages || {},
            cacheDir: opened.cacheDir
        };
    }
}
exports.FileLinkController = FileLinkController;
