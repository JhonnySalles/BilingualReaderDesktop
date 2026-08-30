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
exports.EBookConverterService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const electron_1 = require("electron");
class EBookConverterService {
    static _instance;
    static get instance() {
        if (!this._instance) {
            this._instance = new EBookConverterService();
        }
        return this._instance;
    }
    getCacheDir() {
        const userData = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        const cacheDir = path.join(userData, 'cache', 'converted');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    }
    generateHash(filePath) {
        return crypto.createHash('md5').update(filePath).digest('hex');
    }
    /**
     * Converts a given book file (MOBI, FB2, DOCX, TXT, etc.) into an EPUB format using Pandoc or Calibre ebook-convert CLI.
     */
    async convertToEpub(inputPath) {
        const ext = path.extname(inputPath).toLowerCase();
        if (ext === '.epub' || ext === '.kepub') {
            return inputPath;
        }
        const hash = this.generateHash(inputPath);
        const cacheDir = this.getCacheDir();
        const outputPath = path.join(cacheDir, `${hash}.epub`);
        if (fs.existsSync(outputPath)) {
            return outputPath;
        }
        // Attempt Pandoc conversion first
        const pandocSuccess = await this.runCommand(`pandoc "${inputPath}" -o "${outputPath}"`);
        if (pandocSuccess && fs.existsSync(outputPath)) {
            return outputPath;
        }
        // Fallback: Calibre CLI ebook-convert
        const calibreSuccess = await this.runCommand(`ebook-convert "${inputPath}" "${outputPath}"`);
        if (calibreSuccess && fs.existsSync(outputPath)) {
            return outputPath;
        }
        throw new Error(`Failed to convert file to EPUB: ${inputPath}`);
    }
    runCommand(cmd) {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(cmd, (error) => {
                if (error) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
}
exports.EBookConverterService = EBookConverterService;
