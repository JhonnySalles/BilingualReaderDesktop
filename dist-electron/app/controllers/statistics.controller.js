"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsController = void 0;
const electron_1 = require("electron");
const reading_time_service_1 = require("../services/reading-time.service");
const epub_book_extractor_1 = require("../parser/book/epub-book-extractor");
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
            return true;
        });
    }
}
exports.StatisticsController = StatisticsController;
