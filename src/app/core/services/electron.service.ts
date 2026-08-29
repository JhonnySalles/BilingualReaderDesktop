import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electronAPI?: {
      ping: () => Promise<string>;
      send: (channel: string, data: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  get isElectron(): boolean {
    return !!(window && window.electronAPI);
  }

  async ping(): Promise<string> {
    if (this.isElectron && window.electronAPI?.ping) {
      return await window.electronAPI.ping();
    }
    return 'Electron IPC não está ativo no navegador!';
  }
}
