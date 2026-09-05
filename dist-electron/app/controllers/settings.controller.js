"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const electron_1 = require("electron");
const settings_service_1 = require("../services/settings.service");
const secrets_1 = require("../utils/secrets");
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
                case 'OPENROUTER_API_KEY':
                    return secrets.getOpenRouterApiKey();
                default:
                    return null;
            }
        });
    }
}
exports.SettingsController = SettingsController;
