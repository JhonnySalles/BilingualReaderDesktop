import { BrowserWindow, ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { SettingsService } from '../services/settings.service';
import { GoogleAuthService } from '../services/google-auth.service';
import { ShareMarkBase } from '../services/sharemark/share-mark-base';
import { Secrets } from '../utils/secrets';
import {
  ShareMarkCloud,
  ShareMarkStatus,
  ShareMarkType
} from '../../src/app/core/models/enums/sharemark.enum';

export interface ShareMarkStatusPayload {
  enabled: boolean;
  cloud: ShareMarkCloud;
  signedIn: boolean;
  email: string | null;
  lastSyncManga: string | null;
  lastSyncBook: string | null;
  inSync: boolean;
  oauthConfigured: boolean;
}

export class ShareMarkController {
  constructor(
    private storage: StorageService,
    private getWindow: () => BrowserWindow | null
  ) {}

  public registerIpcHandlers(): void {
    ipcMain.handle('sharemark:status', async () => this.getStatus());

    ipcMain.handle('sharemark:sign-in', async () => {
      try {
        const result = await GoogleAuthService.instance.signIn();
        return { ok: true, email: result.email, status: this.getStatus() };
      } catch (e: any) {
        console.error('[ShareMark] sign-in:', e);
        return { ok: false, error: e?.message || String(e), status: this.getStatus() };
      }
    });

    ipcMain.handle('sharemark:sign-out', async () => {
      await GoogleAuthService.instance.signOut();
      return { ok: true, status: this.getStatus() };
    });

    ipcMain.handle('sharemark:set-enabled', async (_e, enabled: boolean) => {
      SettingsService.instance.set('shareMarkEnabled', !!enabled);
      return this.getStatus();
    });

    ipcMain.handle('sharemark:set-cloud', async (_e, cloud: string) => {
      const previous = SettingsService.instance.get<string>('shareMarkCloud', ShareMarkCloud.GOOGLE_DRIVE);
      const next =
        cloud === ShareMarkCloud.FIRESTORE ? ShareMarkCloud.FIRESTORE : ShareMarkCloud.GOOGLE_DRIVE;
      SettingsService.instance.set('shareMarkCloud', next);
      if (previous !== next) {
        ShareMarkBase.clearLastSync('MANGA');
        ShareMarkBase.clearLastSync('BOOK');
      }
      return this.getStatus();
    });

    ipcMain.handle('sharemark:clear-last-sync', async (_e, type: 'MANGA' | 'BOOK') => {
      ShareMarkBase.clearLastSync(type === 'BOOK' ? 'BOOK' : 'MANGA');
      return this.getStatus();
    });

    ipcMain.handle('sharemark:sync', async (_e, type: 'MANGA' | 'BOOK') => {
      const settings = SettingsService.instance;
      if (!settings.get<boolean>('shareMarkEnabled', false)) {
        return {
          result: ShareMarkType.ERROR,
          message: 'Sincronização desativada nas configurações',
          send: 0,
          receive: 0,
          status: this.getStatus()
        };
      }

      const contentType = type === 'BOOK' ? 'BOOK' : 'MANGA';
      const share = ShareMarkBase.getInstance(this.storage, this.getWindow);
      const win = this.getWindow();

      const onUpdate = (entity: { id?: number }) => {
        win?.webContents.send('sharemark:item-updated', {
          type: contentType,
          id: entity.id
        });
      };

      let result: ShareMarkType;
      try {
        result =
          contentType === 'MANGA'
            ? await share.mangaShareMark(onUpdate)
            : await share.bookShareMark(onUpdate);
      } catch (e) {
        console.error('[ShareMark] sync failed:', e);
        result = ShareMarkType.ERROR;
      }

      return {
        result,
        send: ShareMarkStatus.send,
        receive: ShareMarkStatus.receive,
        status: this.getStatus()
      };
    });
  }

  private getStatus(): ShareMarkStatusPayload {
    const settings = SettingsService.instance;
    const secrets = Secrets.instance;
    return {
      enabled: !!settings.get<boolean>('shareMarkEnabled', false),
      cloud: (settings.get<string>('shareMarkCloud', ShareMarkCloud.GOOGLE_DRIVE) as ShareMarkCloud) ||
        ShareMarkCloud.GOOGLE_DRIVE,
      signedIn: GoogleAuthService.instance.isSignedIn(),
      email: GoogleAuthService.instance.getEmail(),
      lastSyncManga: settings.get<string | null>('shareMarkLastSyncManga', null),
      lastSyncBook: settings.get<string | null>('shareMarkLastSyncBook', null),
      inSync: ShareMarkBase.inSync,
      oauthConfigured: !!(secrets.getGoogleOAuthClientId() && secrets.getGoogleOAuthClientSecret())
    };
  }
}
