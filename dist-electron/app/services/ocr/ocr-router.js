"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrRouter = void 0;
const tesseract_ocr_provider_1 = require("./tesseract-ocr.provider");
const windows_ocr_provider_1 = require("./windows-ocr.provider");
class OcrRouter {
    tesseract = new tesseract_ocr_provider_1.TesseractOcrProvider();
    windows = new windows_ocr_provider_1.WindowsOcrProvider();
    async recognize(input) {
        const pref = input.engine || 'auto';
        if (pref === 'tesseract') {
            return this.tesseract.recognize(input);
        }
        if (pref === 'windows') {
            if (await this.windows.isAvailable()) {
                try {
                    return await this.windows.recognize(input);
                }
                catch (e) {
                    console.warn('[OcrRouter] Windows OCR failed, falling back to Tesseract', e);
                }
            }
            return this.tesseract.recognize(input);
        }
        // auto: prefer Windows for full page when available; region stays tesseract-friendly
        if (input.mode === 'page' && (await this.windows.isAvailable())) {
            try {
                return await this.windows.recognize(input);
            }
            catch (e) {
                console.warn('[OcrRouter] Windows OCR failed, falling back to Tesseract', e);
            }
        }
        return this.tesseract.recognize(input);
    }
    async windowsAvailable() {
        return this.windows.isAvailable();
    }
}
exports.OcrRouter = OcrRouter;
