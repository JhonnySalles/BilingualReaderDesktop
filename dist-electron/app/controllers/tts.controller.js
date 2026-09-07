"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsController = void 0;
const electron_1 = require("electron");
const edge_tts_service_1 = require("../services/tts/edge-tts.service");
class TtsController {
    service = new edge_tts_service_1.EdgeTtsService();
    registerIpcHandlers() {
        electron_1.ipcMain.handle('tts:synthesize', async (_event, req) => {
            return await this.service.synthesize(req || { text: '', voice: '' });
        });
        electron_1.ipcMain.handle('tts:prefetch', async (_event, items) => {
            return await this.service.prefetch(items || []);
        });
        electron_1.ipcMain.handle('tts:clear-cache', async () => {
            return this.service.clearCache();
        });
    }
}
exports.TtsController = TtsController;
