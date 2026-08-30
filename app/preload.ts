import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('app:ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  listMangas: (libraryId?: number) => ipcRenderer.invoke('manga:list', libraryId),
  scanLibrary: (folderPath: string) => ipcRenderer.invoke('manga:scan', folderPath),
  getSetting: (key: string, defaultValue?: any) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  getSecret: (secretKey: string) => ipcRenderer.invoke('secrets:get', secretKey),
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  }
});

