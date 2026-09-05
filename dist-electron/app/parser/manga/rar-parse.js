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
exports.RarParse = void 0;
const fs = __importStar(require("fs"));
const node_unrar_js_1 = require("node-unrar-js");
const parse_util_1 = require("./parse-util");
class RarParse {
    items = [];
    imageItems = [];
    subtitles = [];
    comicInfoItem = null;
    coverItems = [null, null, null];
    async parse(filePath) {
        try {
            const buf = fs.readFileSync(filePath);
            const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            const extractor = await (0, node_unrar_js_1.createExtractorFromData)({ data: arrayBuffer });
            const extracted = extractor.extract({});
            const fileGen = extracted.files;
            if (!fileGen)
                return;
            while (true) {
                let nextItem;
                try {
                    nextItem = fileGen.next();
                }
                catch {
                    break;
                }
                if (!nextItem || nextItem.done)
                    break;
                const file = nextItem.value;
                if (!file || !file.fileHeader || file.fileHeader.flags?.directory)
                    continue;
                const name = file.fileHeader.name;
                const fileData = file.extraction;
                if (!fileData)
                    continue;
                const item = { name, fileData };
                this.items.push(item);
                if (parse_util_1.ParseUtil.isImage(name)) {
                    this.imageItems.push(item);
                    const fileName = parse_util_1.ParseUtil.getNameFromPath(name);
                    if (fileName.toLowerCase().includes('volume')) {
                        const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
                        if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
                            this.coverItems[0] = item;
                        }
                        else if (coverPart.includes('tras') || coverPart.includes('back')) {
                            this.coverItems[1] = item;
                        }
                        else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
                            this.coverItems[2] = item;
                        }
                    }
                }
                else if (parse_util_1.ParseUtil.isJson(name)) {
                    this.subtitles.push(item);
                }
                else if (parse_util_1.ParseUtil.isXml(name) && name.toLowerCase().includes('comicinfo')) {
                    this.comicInfoItem = item;
                }
            }
            this.imageItems.sort((a, b) => {
                const folderA = parse_util_1.ParseUtil.getFolderFromPath(a.name);
                const folderB = parse_util_1.ParseUtil.getFolderFromPath(b.name);
                if (folderA !== folderB) {
                    return folderA.localeCompare(folderB);
                }
                return parse_util_1.ParseUtil.naturalSort(a.name, b.name);
            });
            if (!this.coverItems[0] && this.imageItems.length > 0) {
                this.coverItems[0] = this.imageItems[0];
            }
            if (this.imageItems.length === 0) {
                throw new Error('No images found or not a valid RAR archive');
            }
        }
        catch (e) {
            this.destroy();
            throw e;
        }
    }
    destroy() {
        this.items = [];
        this.imageItems = [];
        this.subtitles = [];
        this.comicInfoItem = null;
        this.coverItems = [null, null, null];
    }
    getPage(num) {
        if (num < 0 || num >= this.imageItems.length)
            return null;
        return Buffer.from(this.imageItems[num].fileData);
    }
    numPages() {
        return this.imageItems.length;
    }
    getSubtitles() {
        return this.subtitles.map(item => Buffer.from(item.fileData).toString('utf-8'));
    }
    hasSubtitles() {
        return this.subtitles.length > 0;
    }
    getSubtitlesNames() {
        const map = {};
        this.subtitles.forEach((item, index) => {
            const name = parse_util_1.ParseUtil.getNameFromPath(item.name);
            if (name && !(name in map)) {
                map[name] = index;
            }
        });
        return map;
    }
    getPagePath(num) {
        if (num < 0 || num >= this.imageItems.length)
            return null;
        return this.imageItems[num].name;
    }
    getPagePaths() {
        const map = {};
        this.imageItems.forEach((item, index) => {
            const folder = parse_util_1.ParseUtil.getFolderFromPath(item.name);
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
        return this.comicInfoItem !== null;
    }
    getComicInfo() {
        if (!this.comicInfoItem)
            return null;
        const content = Buffer.from(this.comicInfoItem.fileData).toString('utf-8');
        return parse_util_1.ParseUtil.parseComicInfoXml(content);
    }
    getCover() {
        const front = this.coverItems[0] ? Buffer.from(this.coverItems[0].fileData) : (this.imageItems.length > 0 ? Buffer.from(this.imageItems[0].fileData) : null);
        const back = this.coverItems[1] ? Buffer.from(this.coverItems[1].fileData) : null;
        return { front, back };
    }
    hasFullCover() {
        return this.coverItems[2] !== null;
    }
    getFullCover() {
        if (!this.coverItems[2])
            return null;
        return Buffer.from(this.coverItems[2].fileData);
    }
}
exports.RarParse = RarParse;
