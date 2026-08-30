"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => electron_1.ipcRenderer.invoke('app:ping'),
    selectDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    listMangas: (libraryId) => electron_1.ipcRenderer.invoke('manga:list', libraryId),
    scanLibrary: (folderPath) => electron_1.ipcRenderer.invoke('manga:scan', folderPath),
    send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
    on: (channel, func) => {
        const subscription = (_event, ...args) => func(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => electron_1.ipcRenderer.removeListener(channel, subscription);
    }
});
