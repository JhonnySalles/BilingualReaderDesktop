import { ipcMain } from 'electron';
import { SettingsService } from '../services/settings.service';
import { Secrets } from '../utils/secrets';

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
      return true;
    });

    ipcMain.handle('secrets:get', async (_event, secretKey: string) => {
      const secrets = Secrets.instance;
      switch (secretKey) {
        case 'ANIME_LIST_CLIENT_ID':
          return secrets.getMyAnimeListClientId();
        case 'GOOGLE_ID_TOKEN':
          return secrets.getGoogleIdToken();
        case 'OPENROUTER_API_KEY':
          return secrets.getOpenRouterApiKey();
        default:
          return null;
      }
    });
  }
}
