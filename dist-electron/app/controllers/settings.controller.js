"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const electron_1 = require("electron");
const settings_service_1 = require("../services/settings.service");
const secrets_1 = require("../utils/secrets");
const telemetry_1 = require("../utils/telemetry");
const menu_controller_1 = require("./menu.controller");
class SettingsController {
    static _instance;
    static get instance() {
        if (!this._instance) {
            this._instance = new SettingsController();
        }
        return this._instance;
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('settings:get', async (_event, key, defaultValue) => {
            return settings_service_1.SettingsService.instance.get(key, defaultValue);
        });
        electron_1.ipcMain.handle('settings:set', async (_event, key, value) => {
            settings_service_1.SettingsService.instance.set(key, value);
            if (key === 'libraries' || key === 'mangaBasePath' || key === 'bookBasePath') {
                menu_controller_1.MenuController.instance.buildMenu();
            }
            return true;
        });
        electron_1.ipcMain.handle('secrets:get', async (_event, secretKey) => {
            const secrets = secrets_1.Secrets.instance;
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
        electron_1.ipcMain.handle('telemetry:is-enabled', async () => telemetry_1.Telemetry.isEnabled);
        electron_1.ipcMain.handle('telemetry:record', async (_event, payload) => {
            const err = telemetry_1.Telemetry.fromSerialized(payload?.error || {});
            telemetry_1.Telemetry.recordException(err, payload?.message);
            return true;
        });
        electron_1.ipcMain.handle('telemetry:set-key', async (_event, key, value) => {
            telemetry_1.Telemetry.setCustomKey(String(key || ''), String(value ?? ''));
            return true;
        });
        electron_1.ipcMain.handle('shell:openExternal', async (_event, url) => {
            const raw = String(url || '').trim();
            if (!raw)
                return false;
            let parsed;
            try {
                parsed = new URL(raw);
            }
            catch {
                return false;
            }
            if (parsed.protocol !== 'https:' &&
                parsed.protocol !== 'http:' &&
                parsed.protocol !== 'mailto:') {
                return false;
            }
            await electron_1.shell.openExternal(parsed.toString());
            return true;
        });
        electron_1.ipcMain.handle('converter:tools-status', async () => {
            const { EBookConverterService } = await Promise.resolve().then(() => __importStar(require('../services/ebook-converter.service')));
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
exports.SettingsController = SettingsController;
