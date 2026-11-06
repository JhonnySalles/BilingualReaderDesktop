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
exports.StatisticsController = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const reading_time_service_1 = require("../services/reading-time.service");
const epub_book_extractor_1 = require("../parser/book/epub-book-extractor");
const main_1 = require("../main");
class StatisticsController {
    storage;
    readingTimeService;
    constructor(storage) {
        this.storage = storage;
        this.readingTimeService = new reading_time_service_1.ReadingTimeCalculatorService(this.storage);
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('statistics:get', async () => {
            return this.storage.getStatisticsOverview();
        });
        electron_1.ipcMain.handle('statistics:chart', async (_event, type, year, libraryId) => {
            return this.storage.getStatisticsChart(type, year, libraryId ?? null);
        });
        electron_1.ipcMain.handle('statistics:years', async (_event, type) => {
            return this.storage.listStatisticsYears(type);
        });
        electron_1.ipcMain.handle('libraries:listByType', async (_event, type) => {
            return this.storage.listLibrariesByType(type);
        });
        electron_1.ipcMain.handle('history:listAggregated', async (_event, options) => {
            return this.storage.listHistoryAggregated(options);
        });
        electron_1.ipcMain.handle('history:listRecent', async (_event, limit) => {
            return this.storage.listRecentReads(limit ?? 3);
        });
        electron_1.ipcMain.handle('history:listForSocialShare', async (_event, options) => {
            return this.storage.listHistoryForSocialShare(options);
        });
        electron_1.ipcMain.handle('social:save-image', async (event, payload) => {
            try {
                const { dataUrl, defaultName = 'leitura-resumo.png' } = payload;
                const win = electron_1.BrowserWindow.fromWebContents(event.sender);
                const dialogOpts = {
                    title: 'Salvar Imagem de Compartilhamento',
                    defaultPath: defaultName,
                    filters: [{ name: 'Imagens PNG', extensions: ['png'] }]
                };
                const saveDialog = win ? await electron_1.dialog.showSaveDialog(win, dialogOpts) : await electron_1.dialog.showSaveDialog(dialogOpts);
                if (saveDialog.canceled || !saveDialog.filePath) {
                    return { success: false, canceled: true };
                }
                const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                await fs.promises.writeFile(saveDialog.filePath, buffer);
                return { success: true, filePath: saveDialog.filePath };
            }
            catch (err) {
                return { success: false, error: err?.message || String(err) };
            }
        });
        electron_1.ipcMain.handle('social:copy-image', async (_event, payload) => {
            try {
                const base64Data = payload.dataUrl.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const blob = new Blob([buffer], { type: 'image/png' });
                const item = new electron_1.ClipboardItem({ 'image/png': blob });
                await electron_1.clipboard.write([item]);
                return { success: true };
            }
            catch (err) {
                return { success: false, error: err?.message || String(err) };
            }
        });
        electron_1.ipcMain.handle('history:delete-by-reference', async (_event, fkReference, type) => {
            return this.storage.deleteHistoryByReference(fkReference, type);
        });
        electron_1.ipcMain.handle('statistics:heatmap', async (_event, _weeks) => {
            return this.storage.getReadingActivityHeatmap();
        });
        electron_1.ipcMain.handle('history:saveBookmarkEdit', async (_event, input) => {
            return this.storage.saveHistoryBookmarkEdit(input);
        });
        electron_1.ipcMain.handle('history:countBookWords', async (_event, filePath, pageStart, pageEnd) => {
            return epub_book_extractor_1.EpubBookExtractor.countWords(filePath, pageStart, pageEnd);
        });
        electron_1.ipcMain.handle('history:recalculateBatch', async (event, options) => {
            return this.readingTimeService.recalculateBatch({
                ...options,
                onProgress: (prog) => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('history:recalculateProgress', prog);
                    }
                }
            });
        });
        electron_1.ipcMain.handle('history:start', async (_event, input) => {
            const sessionId = this.storage.startHistorySession(input);
            const now = new Date().toISOString();
            if (input.type === 'MANGA') {
                const manga = this.storage.findMangaById(input.fkReference);
                if (manga) {
                    this.storage.saveManga({
                        ...manga,
                        lastAccess: now,
                        lastAlteration: now
                    });
                }
            }
            else {
                const book = this.storage.findBookById(input.fkReference);
                if (book) {
                    this.storage.saveBook({
                        ...book,
                        lastAccess: now,
                        lastAlteration: now
                    });
                }
            }
            (0, main_1.updateJumpListTasks)();
            return sessionId;
        });
        electron_1.ipcMain.handle('history:update', async (_event, update) => {
            this.storage.updateHistorySession(update);
            return true;
        });
        electron_1.ipcMain.handle('history:end', async (_event, payload) => {
            this.storage.endHistorySession(payload.id, payload.pageEnd, payload.pages, payload.useTTS);
            if (payload.type && payload.fkReference != null) {
                const now = new Date().toISOString();
                if (payload.type === 'MANGA') {
                    const manga = this.storage.findMangaById(payload.fkReference);
                    if (manga) {
                        const pages = Math.max(1, payload.pages ?? manga.pages ?? 1);
                        const bookMark = Math.min(Math.max(0, Math.floor(payload.pageEnd)), pages);
                        this.storage.saveManga({
                            ...manga,
                            bookMark,
                            completed: bookMark >= pages,
                            lastAccess: now,
                            lastAlteration: now
                        });
                    }
                }
                else {
                    const book = this.storage.findBookById(payload.fkReference);
                    if (book) {
                        const pages = Math.max(1, payload.pages ?? book.pages ?? 1);
                        const bookMark = Math.min(Math.max(0, Math.floor(payload.pageEnd)), pages);
                        this.storage.saveBook({
                            ...book,
                            bookMark,
                            completed: bookMark >= pages,
                            lastAccess: now,
                            lastAlteration: now
                        });
                    }
                }
            }
            (0, main_1.updateJumpListTasks)();
            return true;
        });
    }
}
exports.StatisticsController = StatisticsController;
