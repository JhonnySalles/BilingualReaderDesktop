"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => electron_1.ipcRenderer.invoke('app:ping'),
    selectDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    send: (channel, data) => electron_1.ipcRenderer.send(channel, data),
    on: (channel, func) => {
        electron_1.ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
});
