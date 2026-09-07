"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JapaneseController = void 0;
const electron_1 = require("electron");
const japanese_tokenizer_service_1 = require("../services/japanese-tokenizer.service");
class JapaneseController {
    tokenizer = japanese_tokenizer_service_1.JapaneseTokenizerService.getInstance();
    registerIpcHandlers() {
        electron_1.ipcMain.handle('japanese:init', async () => {
            return this.tokenizer.init();
        });
        electron_1.ipcMain.handle('japanese:toRubyHtml', async (_event, text, withFurigana = true) => {
            if (typeof text !== 'string' || !text)
                return '';
            return this.tokenizer.toRubyHtml(text, withFurigana !== false);
        });
        electron_1.ipcMain.handle('japanese:tokenize', async (_event, text) => {
            if (typeof text !== 'string' || !text)
                return [];
            return this.tokenizer.tokenize(text);
        });
        electron_1.ipcMain.handle('japanese:engine', async () => {
            await this.tokenizer.init();
            return this.tokenizer.getEngine();
        });
    }
}
exports.JapaneseController = JapaneseController;
