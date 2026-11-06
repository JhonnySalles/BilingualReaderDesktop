import { ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SettingsService } from '../services/settings.service';
import { Secrets } from '../utils/secrets';
import { Telemetry } from '../utils/telemetry';
import { MenuController } from './menu.controller';
import { updateJumpListTasks } from '../main';

export class SettingsController {
  private static _instance: SettingsController;

  public static get instance(): SettingsController {
    if (!this._instance) {
      this._instance = new SettingsController();
    }
    return this._instance;
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('settings:get', async (_event, key: string, defaultValue?: any) => {
      return SettingsService.instance.get(key, defaultValue);
    });

    ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
      SettingsService.instance.set(key, value);
      if (key === 'libraries' || key === 'mangaBasePath' || key === 'bookBasePath') {
        MenuController.instance.buildMenu();
        updateJumpListTasks();
      }
      return true;
    });

    ipcMain.handle('secrets:get', async (_event, secretKey: string) => {
      const secrets = Secrets.instance;
      switch (secretKey) {
        case 'ANIME_LIST_CLIENT_ID':
          return secrets.getMyAnimeListClientId();
        case 'GOOGLE_ID_TOKEN':
          return secrets.getGoogleIdToken();
        case 'GOOGLE_OAUTH_CLIENT_ID':
          return secrets.getGoogleOAuthClientId();
        case 'OPENROUTER_API_KEY':
          return secrets.getOpenRouterApiKey();
        case 'FIREBASE_PROJECT_ID':
          return secrets.getFirebaseProjectId();
        default:
          return null;
      }
    });

    ipcMain.handle('telemetry:is-enabled', async () => Telemetry.isEnabled);

    ipcMain.handle(
      'telemetry:record',
      async (
        _event,
        payload: { error: { name?: string; message?: string; stack?: string }; message?: string }
      ) => {
        const err = Telemetry.fromSerialized(payload?.error || {});
        Telemetry.recordException(err, payload?.message);
        return true;
      }
    );

    ipcMain.handle('telemetry:set-key', async (_event, key: string, value: string) => {
      Telemetry.setCustomKey(String(key || ''), String(value ?? ''));
      return true;
    });

    ipcMain.handle('shell:openExternal', async (_event, url: string) => {
      const raw = String(url || '').trim();
      if (!raw) return false;
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return false;
      }
      if (
        parsed.protocol !== 'https:' &&
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'mailto:'
      ) {
        return false;
      }
      await shell.openExternal(parsed.toString());
      return true;
    });

    ipcMain.handle('shell:showItemInFolder', async (_event, fullPath: string) => {
      let raw = String(fullPath || '').trim();
      if (!raw) return false;
      if (raw.startsWith('file:///')) {
        raw = decodeURIComponent(raw.replace('file:///', ''));
      } else if (raw.startsWith('file://')) {
        raw = decodeURIComponent(raw.replace('file://', ''));
      }
      try {
        const resolved = path.resolve(raw);
        const normalized = path.normalize(resolved);
        console.log('[shell:showItemInFolder] Request path:', fullPath, 'Normalized:', normalized);

        if (fs.existsSync(normalized)) {
          if (process.platform === 'win32') {
            try {
              const child = spawn('explorer.exe', ['/select,', normalized], { detached: true, stdio: 'ignore' });
              child.unref();
              return true;
            } catch (winErr) {
              console.warn('[shell:showItemInFolder] Win explorer spawn failed, calling shell:', winErr);
            }
          }
          shell.showItemInFolder(normalized);
          return true;
        }

        const dir = path.dirname(normalized);
        if (fs.existsSync(dir)) {
          if (process.platform === 'win32') {
            try {
              const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' });
              child.unref();
              return true;
            } catch {
              /* ignore */
            }
          }
          await shell.openPath(dir);
          return true;
        }

        const fallbackNorm = path.normalize(raw);
        if (fs.existsSync(fallbackNorm)) {
          shell.showItemInFolder(fallbackNorm);
          return true;
        }
        return false;
      } catch (err) {
        console.error('[shell:showItemInFolder] Error:', err);
        return false;
      }
    });

    ipcMain.handle('converter:tools-status', async () => {
      const { EBookConverterService } = await import('../services/ebook-converter.service');
      const adapters = EBookConverterService.instance.getAdapterStatuses();
      const legacy = EBookConverterService.instance.getToolsStatus();
      return {
        adapters,
        pandoc: !!legacy.pandoc,
        calibre: !!legacy.calibre,
        pandocPath: legacy.pandoc,
        calibrePath: legacy.calibre
      };
    });
  }
}
