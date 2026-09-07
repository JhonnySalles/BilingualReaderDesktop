"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrController = void 0;
const electron_1 = require("electron");
const ocr_router_1 = require("../services/ocr/ocr-router");
class OcrController {
    sessions;
    router = new ocr_router_1.OcrRouter();
    constructor(sessions) {
        this.sessions = sessions;
    }
    registerIpcHandlers() {
        electron_1.ipcMain.handle('ocr:windowsAvailable', async () => {
            return this.router.windowsAvailable();
        });
        electron_1.ipcMain.handle('ocr:recognize', async (_event, payload) => {
            let imagePath;
            if (!payload.dataUrl && payload.sessionId != null && payload.pageIndex != null) {
                imagePath =
                    this.sessions.resolvePageAbsolutePath(payload.sessionId, payload.pageIndex) ||
                        undefined;
            }
            return this.router.recognize({
                imagePath,
                dataUrl: payload.dataUrl,
                lang: payload.lang || 'jpn',
                mode: payload.mode || 'page',
                engine: payload.engine || 'auto'
            });
        });
    }
}
exports.OcrController = OcrController;
