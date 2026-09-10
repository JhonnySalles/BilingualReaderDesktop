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
exports.ParseFactory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const directory_parse_1 = require("./directory-parse");
const zip_parse_1 = require("./zip-parse");
const rar_parse_1 = require("./rar-parse");
const sevenz_parse_1 = require("./sevenz-parse");
const tar_parse_1 = require("./tar-parse");
class ParseFactory {
    static async create(filePath) {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            const parser = new directory_parse_1.DirectoryParse();
            try {
                await parser.parse(filePath);
                if (parser.numPages() < 4) {
                    parser.destroy();
                    return null;
                }
                return parser;
            }
            catch {
                parser.destroy();
                return null;
            }
        }
        const ext = path.extname(filePath).toLowerCase();
        let parser = null;
        if (ext === '.cbz' || ext === '.zip') {
            parser = new zip_parse_1.ZipParse();
        }
        else if (ext === '.cbr' || ext === '.rar') {
            parser = new rar_parse_1.RarParse();
        }
        else if (ext === '.cb7' || ext === '.7z') {
            parser = new sevenz_parse_1.SevenZParse();
        }
        else if (ext === '.cbt' || ext === '.tar' || ext === '.tgz' || ext === '.tar.gz') {
            parser = new tar_parse_1.TarParse();
        }
        if (parser) {
            const result = await this.tryParseInternal(parser, filePath);
            if (result)
                return result;
            // Do not Zip/Rar-fallback dedicated 7z/tar extensions — they are not zip/rar.
            if (ext === '.cb7' || ext === '.7z' || ext === '.cbt' || ext === '.tar' || ext === '.tgz') {
                return null;
            }
        }
        // Fallback for unknown / mislabeled: try Zip then Rar
        const zipFallback = new zip_parse_1.ZipParse();
        const fallbackResult = await this.tryParseInternal(zipFallback, filePath);
        if (fallbackResult)
            return fallbackResult;
        const rarFallback = new rar_parse_1.RarParse();
        return await this.tryParseInternal(rarFallback, filePath);
    }
    static async tryParseInternal(parser, filePath) {
        try {
            await parser.parse(filePath);
            return parser;
        }
        catch (err) {
            console.warn(`[ParseFactory] Failed to parse ${filePath} with ${parser.constructor.name}:`, err);
            try {
                parser.destroy();
            }
            catch { }
            return null;
        }
    }
}
exports.ParseFactory = ParseFactory;
