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
exports.DirectoryParse = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parse_util_1 = require("./parse-util");
class DirectoryParse {
    files = [];
    subtitles = [];
    comicInfoFile = null;
    coverFiles = [null, null, null];
    parse(dirPath) {
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            throw new Error(`Invalid directory path: ${dirPath}`);
        }
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (fs.statSync(fullPath).isDirectory()) {
                continue;
            }
            if (parse_util_1.ParseUtil.isImage(item)) {
                this.files.push(fullPath);
                const fileName = parse_util_1.ParseUtil.getNameFromPath(item);
                if (fileName.toLowerCase().includes('volume')) {
                    const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
                    if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
                        this.coverFiles[0] = fullPath;
                    }
                    else if (coverPart.includes('tras') || coverPart.includes('back')) {
                        this.coverFiles[1] = fullPath;
                    }
                    else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
                        this.coverFiles[2] = fullPath;
                    }
                }
            }
            else if (parse_util_1.ParseUtil.isJson(item)) {
                this.subtitles.push(fullPath);
            }
            else if (parse_util_1.ParseUtil.isXml(item) && item.toLowerCase().includes('comicinfo')) {
                this.comicInfoFile = fullPath;
            }
        }
        this.files.sort((a, b) => parse_util_1.ParseUtil.naturalSort(a, b));
        if (!this.coverFiles[0] && this.files.length > 0) {
            this.coverFiles[0] = this.files[0];
        }
    }
    destroy() {
        this.files = [];
        this.subtitles = [];
        this.comicInfoFile = null;
        this.coverFiles = [null, null, null];
    }
    getPage(num) {
        if (num < 0 || num >= this.files.length)
            return null;
        return fs.readFileSync(this.files[num]);
    }
    numPages() {
        return this.files.length;
    }
    getSubtitles() {
        return this.subtitles.map(filePath => fs.readFileSync(filePath, 'utf-8'));
    }
    hasSubtitles() {
        return this.subtitles.length > 0;
    }
    getSubtitlesNames() {
        const map = {};
        this.subtitles.forEach((file, index) => {
            const name = parse_util_1.ParseUtil.getNameFromPath(file);
            if (name && !(name in map)) {
                map[name] = index;
            }
        });
        return map;
    }
    getPagePath(num) {
        if (num < 0 || num >= this.files.length)
            return null;
        return parse_util_1.ParseUtil.getNameFromPath(this.files[num]);
    }
    getPagePaths() {
        const map = {};
        this.files.forEach((file, index) => {
            const folder = parse_util_1.ParseUtil.getFolderFromPath(file);
            if (folder && !(folder in map)) {
                map[folder] = index;
            }
        });
        return map;
    }
    getChapters() {
        const paths = this.getPagePaths();
        return Object.values(paths).filter(val => val !== 0);
    }
    isComicInfo() {
        return this.comicInfoFile !== null;
    }
    getComicInfo() {
        if (!this.comicInfoFile)
            return null;
        const content = fs.readFileSync(this.comicInfoFile, 'utf-8');
        return parse_util_1.ParseUtil.parseComicInfoXml(content);
    }
    getCover() {
        const front = this.coverFiles[0] ? fs.readFileSync(this.coverFiles[0]) : (this.files.length > 0 ? fs.readFileSync(this.files[0]) : null);
        const back = this.coverFiles[1] ? fs.readFileSync(this.coverFiles[1]) : null;
        return { front, back };
    }
    hasFullCover() {
        return this.coverFiles[2] !== null;
    }
    getFullCover() {
        if (!this.coverFiles[2])
            return null;
        return fs.readFileSync(this.coverFiles[2]);
    }
}
exports.DirectoryParse = DirectoryParse;
