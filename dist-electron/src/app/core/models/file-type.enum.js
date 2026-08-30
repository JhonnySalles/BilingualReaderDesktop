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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANGA_EXTENSIONS = void 0;
exports.getMangaFileType = getMangaFileType;
exports.isMangaFile = isMangaFile;
__exportStar(require("./enums/app-enums"), exports);
exports.MANGA_EXTENSIONS = {
    cbz: 'CBZ',
    cbr: 'CBR',
    cb7: 'CB7',
    cbt: 'CBT',
    zip: 'ZIP',
    rar: 'RAR',
    '7z': '7Z',
    tar: 'TAR',
    epub: 'EPUB',
    epub3: 'EPUB3'
};
function getMangaFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return exports.MANGA_EXTENSIONS[ext] || 'UNKNOWN';
}
function isMangaFile(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return ext in exports.MANGA_EXTENSIONS;
}
