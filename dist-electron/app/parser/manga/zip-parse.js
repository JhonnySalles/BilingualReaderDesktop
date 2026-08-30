"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZipParse = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const parse_util_1 = require("./parse-util");
class ZipParse {
    zip = null;
    entries = [];
    subtitles = [];
    comicInfoEntry = null;
    coverEntries = [null, null, null];
    parse(filePath) {
        this.zip = new adm_zip_1.default(filePath);
        const zipEntries = this.zip.getEntries();
        for (const entry of zipEntries) {
            if (entry.isDirectory)
                continue;
            const name = entry.entryName;
            if (parse_util_1.ParseUtil.isImage(name)) {
                this.entries.push(entry);
                const fileName = parse_util_1.ParseUtil.getNameFromPath(name);
                if (fileName.toLowerCase().includes('volume')) {
                    const coverPart = fileName.toLowerCase().substring(fileName.toLowerCase().lastIndexOf('volume'));
                    if (coverPart.includes('frente') || coverPart.includes('cover') || coverPart.includes('front')) {
                        this.coverEntries[0] = entry;
                    }
                    else if (coverPart.includes('tras') || coverPart.includes('back')) {
                        this.coverEntries[1] = entry;
                    }
                    else if (coverPart.includes('tudo') || coverPart.includes('all') || coverPart.includes('everything')) {
                        this.coverEntries[2] = entry;
                    }
                }
            }
            else if (parse_util_1.ParseUtil.isJson(name)) {
                this.subtitles.push(entry);
            }
            else if (parse_util_1.ParseUtil.isXml(name) && name.toLowerCase().includes('comicinfo')) {
                this.comicInfoEntry = entry;
            }
        }
        this.entries.sort((a, b) => {
            const folderA = parse_util_1.ParseUtil.getFolderFromPath(a.entryName);
            const folderB = parse_util_1.ParseUtil.getFolderFromPath(b.entryName);
            if (folderA !== folderB) {
                return folderA.localeCompare(folderB);
            }
            return parse_util_1.ParseUtil.naturalSort(a.entryName, b.entryName);
        });
        if (!this.coverEntries[0] && this.entries.length > 0) {
            this.coverEntries[0] = this.entries[0];
        }
    }
    destroy() {
        this.zip = null;
        this.entries = [];
        this.subtitles = [];
        this.comicInfoEntry = null;
        this.coverEntries = [null, null, null];
    }
    getPage(num) {
        if (!this.zip || num < 0 || num >= this.entries.length)
            return null;
        return this.zip.readFile(this.entries[num]);
    }
    numPages() {
        return this.entries.length;
    }
    getSubtitles() {
        if (!this.zip)
            return [];
        return this.subtitles.map(entry => this.zip.readAsText(entry));
    }
    hasSubtitles() {
        return this.subtitles.length > 0;
    }
    getSubtitlesNames() {
        const map = {};
        this.subtitles.forEach((entry, index) => {
            const name = parse_util_1.ParseUtil.getNameFromPath(entry.entryName);
            if (name && !(name in map)) {
                map[name] = index;
            }
        });
        return map;
    }
    getPagePath(num) {
        if (num < 0 || num >= this.entries.length)
            return null;
        return this.entries[num].entryName;
    }
    getPagePaths() {
        const map = {};
        this.entries.forEach((entry, index) => {
            const folder = parse_util_1.ParseUtil.getFolderFromPath(entry.entryName);
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
        return this.comicInfoEntry !== null;
    }
    getComicInfo() {
        if (!this.zip || !this.comicInfoEntry)
            return null;
        const content = this.zip.readAsText(this.comicInfoEntry);
        return parse_util_1.ParseUtil.parseComicInfoXml(content);
    }
    getCover() {
        if (!this.zip)
            return { front: null, back: null };
        const front = this.coverEntries[0] ? this.zip.readFile(this.coverEntries[0]) : (this.entries.length > 0 ? this.zip.readFile(this.entries[0]) : null);
        const back = this.coverEntries[1] ? this.zip.readFile(this.coverEntries[1]) : null;
        return { front, back };
    }
    hasFullCover() {
        return this.coverEntries[2] !== null;
    }
    getFullCover() {
        if (!this.zip || !this.coverEntries[2])
            return null;
        return this.zip.readFile(this.coverEntries[2]);
    }
}
exports.ZipParse = ZipParse;
