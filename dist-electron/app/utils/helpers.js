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
exports.FileUtil = exports.Util = void 0;
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
class Util {
    static MD5(input) {
        if (typeof input === 'string') {
            return crypto.createHash('md5').update(input).digest('hex');
        }
        return crypto.createHash('md5').update(input).digest('hex');
    }
    static getNameFromPath(filePath) {
        if (!filePath)
            return '';
        return path.basename(filePath);
    }
    static getNameWithoutExtensionFromPath(filePath) {
        if (!filePath)
            return '';
        const name = path.basename(filePath);
        const ext = path.extname(name);
        return ext ? name.substring(0, name.length - ext.length) : name;
    }
    static getExtensionFromPath(filePath) {
        if (!filePath)
            return '';
        const ext = path.extname(filePath);
        return ext.startsWith('.') ? ext.substring(1) : ext;
    }
    static getNameWithoutVolumeAndChapter(mangaTitle) {
        if (!mangaTitle)
            return '';
        let name = mangaTitle;
        if (name.includes(' - ')) {
            name = name.substring(0, name.lastIndexOf(' - '));
        }
        const lower = name.toLowerCase();
        if (lower.includes('volume')) {
            const idx = lower.lastIndexOf('volume');
            name = name.substring(0, idx).trim();
        }
        else if (lower.includes('capitulo')) {
            const idx = lower.lastIndexOf('capitulo');
            name = name.substring(0, idx).trim();
        }
        else if (lower.includes('capítulo')) {
            const idx = lower.lastIndexOf('capítulo');
            name = name.substring(0, idx).trim();
        }
        return name.trim();
    }
    static normalizeNameCache(name, prefix = '', isRandom = true) {
        let normalize = name;
        if (name.includes('-')) {
            normalize = name.split('-')[0];
        }
        else if (name.includes(' ')) {
            normalize = name.split(' ')[0];
        }
        const randomStr = isRandom ? Math.floor(Math.random() * 1000000).toString() : '';
        const cleaned = normalize.replace(/[^\w\d ]/g, '').replace(/\s+/g, '_').trim().toLowerCase();
        return `${prefix}${cleaned}${randomStr}`;
    }
    static normalizeFilePath(filePath) {
        let folder = filePath;
        if (folder.includes('primary')) {
            folder = folder.replace('primary', 'emulated/0');
        }
        if (folder.includes('/tree')) {
            folder = folder.replace('/tree', '/storage').replace(/:/g, '/');
        }
        else if (folder.includes('/document')) {
            folder = folder.replace('/document', '/storage').replace(/:/g, '/');
        }
        return folder;
    }
    static getChapterFromPath(filePath) {
        if (!filePath)
            return -1;
        const normalized = filePath.replace(/[/\\]+$/, '');
        let folder = path.basename(normalized);
        const lower = folder.toLowerCase();
        if (lower.includes('capitulo')) {
            folder = folder.substring(lower.lastIndexOf('capitulo') + 8);
        }
        else if (lower.includes('capítulo')) {
            folder = folder.substring(lower.lastIndexOf('capítulo') + 8);
        }
        const parsed = parseFloat(folder.trim());
        return isNaN(parsed) ? -1 : parsed;
    }
    static getFolderFromPath(filePath) {
        if (!filePath)
            return '';
        const dir = path.dirname(filePath);
        return dir === '.' ? '' : dir;
    }
    static getNormalizedNameOrdering(filePath) {
        const name = Util.getNameWithoutExtensionFromPath(filePath);
        const match = name.match(/(\d+|\d+\w|\d+\.\d+|[\(\{\[]\d+[\)\}\]])$/);
        if (!match)
            return Util.getNameFromPath(filePath);
        const numbers = match[0];
        const padded = numbers.padStart(10, '0');
        const baseName = name.substring(0, name.lastIndexOf(numbers));
        const ext = Util.getExtensionFromPath(filePath);
        return `${baseName}${padded}${ext ? '.' + ext : ''}`;
    }
}
exports.Util = Util;
class FileUtil {
    static isXml(filename) {
        return /\.xml$/i.test(filename);
    }
    static isJson(filename) {
        return /\.json$/i.test(filename);
    }
    static isImage(filename) {
        return /\.(jpg|jpeg|bmp|gif|png|webp|avif|heic|heif|jxl|tiff|tif|pcx|jpf|jp2|j2k|jpx|pbm|pgm|ppm|pnm|iff)$/i.test(filename);
    }
    static isHtml(filename) {
        return /\.(html|xhtml)$/i.test(filename);
    }
    static getFileType(filename) {
        const ext = Util.getExtensionFromPath(filename).toLowerCase();
        switch (ext) {
            case 'cbz':
            case 'cbr':
            case 'cb7':
            case 'cbt':
            case 'rar':
            case 'zip':
            case '7z':
            case 'tar':
                return app_enums_1.FileType.ZIP;
            case 'pdf':
                return app_enums_1.FileType.PDF;
            case 'epub':
                return app_enums_1.FileType.EPUB;
            case 'mobi':
                return app_enums_1.FileType.MOBI;
            case 'txt':
                return app_enums_1.FileType.TXT;
            default:
                if (FileUtil.isImage(filename))
                    return app_enums_1.FileType.IMAGE;
                return app_enums_1.FileType.UNKNOWN;
        }
    }
    static formatSize(size) {
        if (size < 1024)
            return `${size} B`;
        const i = Math.floor(Math.log(size) / Math.log(1024));
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        return `${(size / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
}
exports.FileUtil = FileUtil;
