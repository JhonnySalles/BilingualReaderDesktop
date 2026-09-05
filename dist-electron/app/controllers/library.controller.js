"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryController = void 0;
const electron_1 = require("electron");
class LibraryController {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('manga:save', async (_event, manga) => {
            const id = this.storage.saveManga(manga);
            return this.storage.findMangaById(id) ?? null;
        });
        electron_1.ipcMain.handle('book:save', async (_event, book) => {
            const id = this.storage.saveBook(book);
            return this.storage.findBookById(id) ?? null;
        });
        electron_1.ipcMain.handle('manga:delete', async (_event, id) => {
            this.storage.softDeleteManga(id);
            return true;
        });
        electron_1.ipcMain.handle('book:delete', async (_event, id) => {
            this.storage.softDeleteBook(id);
            return true;
        });
        electron_1.ipcMain.handle('manga:clearProgress', async (_event, id) => {
            return this.storage.clearMangaProgress(id) ?? null;
        });
        electron_1.ipcMain.handle('book:clearProgress', async (_event, id) => {
            return this.storage.clearBookProgress(id) ?? null;
        });
        electron_1.ipcMain.handle('manga:markRead', async (_event, id) => {
            return this.storage.markMangaRead(id) ?? null;
        });
        electron_1.ipcMain.handle('book:markRead', async (_event, id) => {
            return this.storage.markBookRead(id) ?? null;
        });
    }
}
exports.LibraryController = LibraryController;
