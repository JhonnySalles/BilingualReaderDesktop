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
exports.EBookConverterService = exports.DEFAULT_EBOOK_CONVERT_MODE = exports.EBOOK_CONVERT_MODE_KEY = exports.EbookConversionError = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const app_paths_1 = require("../utils/app-paths");
const ebook_convert_factory_1 = require("./ebook-convert/ebook-convert.factory");
const types_1 = require("./ebook-convert/types");
const settings_service_1 = require("./settings.service");
var types_2 = require("./ebook-convert/types");
Object.defineProperty(exports, "EbookConversionError", { enumerable: true, get: function () { return types_2.EbookConversionError; } });
var types_3 = require("./ebook-convert/types");
Object.defineProperty(exports, "EBOOK_CONVERT_MODE_KEY", { enumerable: true, get: function () { return types_3.EBOOK_CONVERT_MODE_KEY; } });
Object.defineProperty(exports, "DEFAULT_EBOOK_CONVERT_MODE", { enumerable: true, get: function () { return types_3.DEFAULT_EBOOK_CONVERT_MODE; } });
/**
 * Public facade: cache + hash + convertToEpub, delegates to EbookConvertFactory.
 */
class EBookConverterService {
    static _instance;
    factory = new ebook_convert_factory_1.EbookConvertFactory();
    static get instance() {
        if (!this._instance) {
            this._instance = new EBookConverterService();
        }
        return this._instance;
    }
    getCacheDir() {
        const cacheDir = path.join((0, app_paths_1.getAppCacheDir)(), 'convert');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    }
    getConvertMode() {
        try {
            const raw = settings_service_1.SettingsService.instance.get(types_1.EBOOK_CONVERT_MODE_KEY, types_1.DEFAULT_EBOOK_CONVERT_MODE);
            return (0, types_1.normalizeEbookConvertMode)(raw);
        }
        catch {
            return types_1.DEFAULT_EBOOK_CONVERT_MODE;
        }
    }
    generateHash(inputPath, mtimeMs, size, mode = types_1.DEFAULT_EBOOK_CONVERT_MODE) {
        return crypto
            .createHash('md5')
            .update(`${inputPath}|${mtimeMs}|${size}|${mode}`)
            .digest('hex');
    }
    clearToolsCache() {
        this.factory.clearCliCaches();
    }
    /** Legacy shape for IPC consumers that still expect pandoc/calibre paths. */
    getToolsStatus() {
        const statuses = this.factory.getAdapterStatuses();
        const pandoc = statuses.find(s => s.id === 'pandoc');
        const calibre = statuses.find(s => s.id === 'calibre');
        return {
            pandoc: pandoc?.detail && pandoc.available ? pandoc.detail : null,
            calibre: calibre?.detail && calibre.available ? calibre.detail : null
        };
    }
    getAdapterStatuses() {
        return this.factory.getAdapterStatuses();
    }
    /**
     * Converts a book file into EPUB via the adapter factory.
     * Native EPUB/KEPUB/EPUB3 are returned unchanged (no cache copy).
     */
    async convertToEpub(inputPath) {
        if (!fs.existsSync(inputPath)) {
            throw new types_1.EbookConversionError(`Arquivo não encontrado: ${inputPath}`, 'not_found');
        }
        const ext = (0, types_1.normalizeExt)(inputPath);
        if (ext === '.epub' || ext === '.kepub' || ext === '.epub3') {
            return inputPath;
        }
        const mode = this.getConvertMode();
        const stat = fs.statSync(inputPath);
        const hash = this.generateHash(inputPath, stat.mtimeMs, stat.size, mode);
        const cacheDir = this.getCacheDir();
        const outputPath = path.join(cacheDir, `${hash}.epub`);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return outputPath;
        }
        this.pruneLegacyCache(inputPath, hash);
        await this.factory.convert(inputPath, outputPath, mode);
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new types_1.EbookConversionError(`Falha ao converter para EPUB: ${path.basename(inputPath)}`, 'conversion_failed');
        }
        return outputPath;
    }
    pruneLegacyCache(inputPath, currentHash) {
        try {
            const legacy = crypto.createHash('md5').update(inputPath).digest('hex');
            if (legacy === currentHash)
                return;
            const legacyPath = path.join(this.getCacheDir(), `${legacy}.epub`);
            if (fs.existsSync(legacyPath)) {
                fs.unlinkSync(legacyPath);
            }
        }
        catch {
            /* ignore */
        }
    }
}
exports.EBookConverterService = EBookConverterService;
