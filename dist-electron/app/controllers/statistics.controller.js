"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsController = void 0;
const electron_1 = require("electron");
class StatisticsController {
    storage;
    constructor(storage) {
        this.storage = storage;
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
        electron_1.ipcMain.handle('history:start', async (_event, input) => {
            return this.storage.startHistorySession(input);
        });
        electron_1.ipcMain.handle('history:update', async (_event, update) => {
            this.storage.updateHistorySession(update);
            return true;
        });
        electron_1.ipcMain.handle('history:end', async (_event, payload) => {
            this.storage.endHistorySession(payload.id, payload.pageEnd, payload.pages);
            if (payload.type && payload.fkReference != null) {
                const now = new Date().toISOString();
                if (payload.type === 'MANGA') {
                    const manga = this.storage.findMangaById(payload.fkReference);
                    if (manga) {
                        this.storage.saveManga({
                            ...manga,
                            bookMark: payload.pageEnd,
                            completed: payload.pages != null ? payload.pageEnd >= payload.pages : manga.completed,
                            lastAccess: now,
                            lastAlteration: now
                        });
                    }
                }
                else {
                    const book = this.storage.findBookById(payload.fkReference);
                    if (book) {
                        this.storage.saveBook({
                            ...book,
                            bookMark: payload.pageEnd,
                            completed: payload.pages != null ? payload.pageEnd >= payload.pages : book.completed,
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
