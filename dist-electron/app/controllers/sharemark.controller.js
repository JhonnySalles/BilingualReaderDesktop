"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareMarkController = void 0;
const electron_1 = require("electron");
const settings_service_1 = require("../services/settings.service");
const google_auth_service_1 = require("../services/google-auth.service");
const share_mark_base_1 = require("../services/sharemark/share-mark-base");
const secrets_1 = require("../utils/secrets");
const sharemark_enum_1 = require("../../src/app/core/models/enums/sharemark.enum");
const telemetry_1 = require("../utils/telemetry");
class ShareMarkController {
    storage;
    getWindow;
    constructor(storage, getWindow) {
        this.storage = storage;
        this.getWindow = getWindow;
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('sharemark:status', async () => this.getStatus());
        electron_1.ipcMain.handle('sharemark:sign-in', async () => {
            try {
                const result = await google_auth_service_1.GoogleAuthService.instance.signIn();
                return { ok: true, email: result.email, status: this.getStatus() };
            }
            catch (e) {
                console.error('[ShareMark] sign-in:', e);
                telemetry_1.Telemetry.recordException(e, '[ShareMark] sign-in');
                return { ok: false, error: e?.message || String(e), status: this.getStatus() };
            }
        });
        electron_1.ipcMain.handle('sharemark:sign-out', async () => {
            await google_auth_service_1.GoogleAuthService.instance.signOut();
            return { ok: true, status: this.getStatus() };
        });
        electron_1.ipcMain.handle('sharemark:set-enabled', async (_e, enabled) => {
            settings_service_1.SettingsService.instance.set('shareMarkEnabled', !!enabled);
            return this.getStatus();
        });
        electron_1.ipcMain.handle('sharemark:set-cloud', async (_e, cloud) => {
            const previous = settings_service_1.SettingsService.instance.get('shareMarkCloud', sharemark_enum_1.ShareMarkCloud.GOOGLE_DRIVE);
            const next = cloud === sharemark_enum_1.ShareMarkCloud.FIRESTORE ? sharemark_enum_1.ShareMarkCloud.FIRESTORE : sharemark_enum_1.ShareMarkCloud.GOOGLE_DRIVE;
            settings_service_1.SettingsService.instance.set('shareMarkCloud', next);
            if (previous !== next) {
                share_mark_base_1.ShareMarkBase.clearLastSync('MANGA');
                share_mark_base_1.ShareMarkBase.clearLastSync('BOOK');
            }
            return this.getStatus();
        });
        electron_1.ipcMain.handle('sharemark:clear-last-sync', async (_e, type) => {
            share_mark_base_1.ShareMarkBase.clearLastSync(type === 'BOOK' ? 'BOOK' : 'MANGA');
            return this.getStatus();
        });
        electron_1.ipcMain.handle('sharemark:sync', async (_e, type) => {
            const settings = settings_service_1.SettingsService.instance;
            if (!settings.get('shareMarkEnabled', false)) {
                return {
                    result: sharemark_enum_1.ShareMarkType.ERROR,
                    message: 'Sincronização desativada nas configurações',
                    send: 0,
                    receive: 0,
                    status: this.getStatus()
                };
            }
            const contentType = type === 'BOOK' ? 'BOOK' : 'MANGA';
            const share = share_mark_base_1.ShareMarkBase.getInstance(this.storage, this.getWindow);
            const win = this.getWindow();
            const onUpdate = (entity) => {
                win?.webContents.send('sharemark:item-updated', {
                    type: contentType,
                    id: entity.id
                });
            };
            let result;
            try {
                result =
                    contentType === 'MANGA'
                        ? await share.mangaShareMark(onUpdate)
                        : await share.bookShareMark(onUpdate);
            }
            catch (e) {
                console.error('[ShareMark] sync failed:', e);
                telemetry_1.Telemetry.recordException(e, '[ShareMark] sync failed');
                result = sharemark_enum_1.ShareMarkType.ERROR;
            }
            return {
                result,
                send: sharemark_enum_1.ShareMarkStatus.send,
                receive: sharemark_enum_1.ShareMarkStatus.receive,
                status: this.getStatus()
            };
        });
    }
    getStatus() {
        const settings = settings_service_1.SettingsService.instance;
        const secrets = secrets_1.Secrets.instance;
        return {
            enabled: !!settings.get('shareMarkEnabled', false),
            cloud: settings.get('shareMarkCloud', sharemark_enum_1.ShareMarkCloud.GOOGLE_DRIVE) ||
                sharemark_enum_1.ShareMarkCloud.GOOGLE_DRIVE,
            signedIn: google_auth_service_1.GoogleAuthService.instance.isSignedIn(),
            email: google_auth_service_1.GoogleAuthService.instance.getEmail(),
            lastSyncManga: settings.get('shareMarkLastSyncManga', null),
            lastSyncBook: settings.get('shareMarkLastSyncBook', null),
            inSync: share_mark_base_1.ShareMarkBase.inSync,
            oauthConfigured: !!(secrets.getGoogleOAuthClientId() && secrets.getGoogleOAuthClientSecret())
        };
    }
}
exports.ShareMarkController = ShareMarkController;
