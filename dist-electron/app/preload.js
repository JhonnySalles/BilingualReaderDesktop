"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => electron_1.ipcRenderer.invoke('app:ping'),
    selectDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    listMangas: (folderPath) => electron_1.ipcRenderer.invoke('manga:list', folderPath),
    scanLibrary: (folderPath) => electron_1.ipcRenderer.invoke('manga:scan', folderPath),
    listBooks: (folderPath) => electron_1.ipcRenderer.invoke('book:list', folderPath),
    scanBookLibrary: (folderPath) => electron_1.ipcRenderer.invoke('book:scan', folderPath),
    getLibraryCount: (libraryId, type) => electron_1.ipcRenderer.invoke('library:get-count', libraryId, type),
    getManga: (id) => electron_1.ipcRenderer.invoke('manga:get', id),
    getBook: (id) => electron_1.ipcRenderer.invoke('book:get', id),
    saveManga: (manga) => electron_1.ipcRenderer.invoke('manga:save', manga),
    saveBook: (book) => electron_1.ipcRenderer.invoke('book:save', book),
    deleteManga: (id) => electron_1.ipcRenderer.invoke('manga:delete', id),
    deleteBook: (id) => electron_1.ipcRenderer.invoke('book:delete', id),
    clearMangaProgress: (id) => electron_1.ipcRenderer.invoke('manga:clear-progress', id),
    clearBookProgress: (id) => electron_1.ipcRenderer.invoke('book:clear-progress', id),
    markMangaRead: (id) => electron_1.ipcRenderer.invoke('manga:markRead', id),
    markBookRead: (id) => electron_1.ipcRenderer.invoke('book:markRead', id),
    getSetting: (key, defaultValue) => electron_1.ipcRenderer.invoke('settings:get', key, defaultValue),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('settings:set', key, value),
    getSecret: (secretKey) => electron_1.ipcRenderer.invoke('secrets:get', secretKey),
    getStatistics: () => electron_1.ipcRenderer.invoke('statistics:get'),
    getStatisticsChart: (type, year, libraryId) => electron_1.ipcRenderer.invoke('statistics:chart', type, year, libraryId),
    getStatisticsYears: (type) => electron_1.ipcRenderer.invoke('statistics:years', type),
    listLibrariesByType: (type) => electron_1.ipcRenderer.invoke('libraries:listByType', type),
    listHistoryAggregated: (options) => electron_1.ipcRenderer.invoke('history:listAggregated', options),
    startHistorySession: (input) => electron_1.ipcRenderer.invoke('history:start', input),
    updateHistorySession: (update) => electron_1.ipcRenderer.invoke('history:update', update),
    endHistorySession: (payload) => electron_1.ipcRenderer.invoke('history:end', payload),
    openMangaReader: (mangaId) => electron_1.ipcRenderer.invoke('manga-reader:open', mangaId),
    closeMangaReader: (sessionId) => electron_1.ipcRenderer.invoke('manga-reader:close', sessionId),
    setMangaBookmark: (mangaId, page) => electron_1.ipcRenderer.invoke('manga:set-bookmark', mangaId, page),
    toggleMangaFavorite: (mangaId) => electron_1.ipcRenderer.invoke('manga:toggle-favorite', mangaId),
    openBookReader: (bookId) => electron_1.ipcRenderer.invoke('book-reader:open', bookId),
    closeBookReader: (sessionId) => electron_1.ipcRenderer.invoke('book-reader:close', sessionId),
    setBookBookmark: (payload) => electron_1.ipcRenderer.invoke('book:set-bookmark', payload),
    toggleBookFavorite: (bookId) => electron_1.ipcRenderer.invoke('book:toggle-favorite', bookId),
    getBookConfiguration: (bookId) => electron_1.ipcRenderer.invoke('book:get-configuration', bookId),
    saveBookConfiguration: (config) => electron_1.ipcRenderer.invoke('book:save-configuration', config),
    send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
    on: (channel, func) => {
        const subscription = (_event, ...args) => func(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => electron_1.ipcRenderer.removeListener(channel, subscription);
    }
});
