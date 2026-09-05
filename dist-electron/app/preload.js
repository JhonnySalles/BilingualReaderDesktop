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
    getSetting: (key, defaultValue) => electron_1.ipcRenderer.invoke('settings:get', key, defaultValue),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('settings:set', key, value),
    getSecret: (secretKey) => electron_1.ipcRenderer.invoke('secrets:get', secretKey),
    send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
    on: (channel, func) => {
        const subscription = (_event, ...args) => func(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => electron_1.ipcRenderer.removeListener(channel, subscription);
    }
});
