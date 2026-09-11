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
exports.TesseractOcrProvider = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const tesseract_js_1 = require("tesseract.js");
const app_paths_1 = require("../../utils/app-paths");
const constants_1 = require("../../utils/constants");
const LANGS = new Set(['eng', 'por', 'jpn', 'jpn_vert']);
/**
 * Tesseract.js OCR with tessdata under userData/cache/Tesseract/tessdata
 * (Android CACHE_FOLDER.TESSERACT parity). Bundled packs live in app/assets/tessdata.
 */
class TesseractOcrProvider {
    id = 'tesseract';
    worker = null;
    workerLang = null;
    readyPromise = null;
    async isAvailable() {
        try {
            this.ensureTessdata();
            return true;
        }
        catch {
            return false;
        }
    }
    async recognize(input) {
        const lang = LANGS.has(input.lang) ? input.lang : 'jpn';
        await this.ensureWorker(lang);
        const source = input.dataUrl || input.imagePath;
        if (!source) {
            throw new Error('Imagem OCR não informada');
        }
        const result = await this.worker.recognize(source);
        const blocks = [];
        const words = result.data.words;
        if (Array.isArray(words)) {
            for (const w of words) {
                const text = (w.text || '').trim();
                if (!text)
                    continue;
                blocks.push({
                    text,
                    x: w.bbox.x0,
                    y: w.bbox.y0,
                    width: Math.max(1, w.bbox.x1 - w.bbox.x0),
                    height: Math.max(1, w.bbox.y1 - w.bbox.y0)
                });
            }
        }
        return {
            fullText: (result.data.text || '').replace(/\n+/g, ' ').trim(),
            blocks,
            engine: 'tesseract'
        };
    }
    async dispose() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.workerLang = null;
        }
    }
    tessdataDir() {
        return path.join((0, app_paths_1.getAppBaseDir)(), 'cache', constants_1.GeneralConsts.CACHE_FOLDER.TESSERACT, 'tessdata');
    }
    bundledTessdataDir() {
        const candidates = [
            path.join(electron_1.app.getAppPath(), 'app/assets/tessdata'),
            path.join(__dirname, '../../assets/tessdata'),
            path.join(process.resourcesPath || '', 'tessdata'),
            path.join(electron_1.app.getAppPath(), 'assets/tessdata')
        ];
        for (const c of candidates) {
            if (fs.existsSync(c))
                return c;
        }
        return candidates[0];
    }
    ensureTessdata() {
        const dest = this.tessdataDir();
        fs.mkdirSync(dest, { recursive: true });
        const src = this.bundledTessdataDir();
        for (const lang of LANGS) {
            const name = `${lang}.traineddata`;
            const from = path.join(src, name);
            const to = path.join(dest, name);
            const best = path.join(dest, `${lang}.traineddata.best`);
            // Prefer manually dropped tessdata_best if present
            if (fs.existsSync(best) && !fs.existsSync(to)) {
                fs.copyFileSync(best, to);
                continue;
            }
            if (!fs.existsSync(to) && fs.existsSync(from)) {
                fs.copyFileSync(from, to);
            }
        }
    }
    async ensureWorker(lang) {
        this.ensureTessdata();
        if (this.worker && this.workerLang === lang)
            return;
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
        const langPath = this.tessdataDir();
        this.worker = await (0, tesseract_js_1.createWorker)(lang, 1, {
            langPath,
            gzip: false,
            cachePath: langPath,
            cacheMethod: 'none'
        });
        this.workerLang = lang;
    }
}
exports.TesseractOcrProvider = TesseractOcrProvider;
