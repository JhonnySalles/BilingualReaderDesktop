import { ipcMain } from 'electron';
import { SettingsService } from '../services/settings.service';
import { Secrets } from '../utils/secrets';
import { Telemetry } from '../utils/telemetry';
import { MenuController } from './menu.controller';

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
  }
}
