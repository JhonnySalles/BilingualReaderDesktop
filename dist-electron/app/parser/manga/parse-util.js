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
exports.ParseUtil = void 0;
const path = __importStar(require("path"));
class ParseUtil {
    static IMAGE_EXTENSIONS = new Set([
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'
    ]);
    static isImage(filename) {
        const ext = path.extname(filename).toLowerCase();
        return this.IMAGE_EXTENSIONS.has(ext);
    }
    static isJson(filename) {
        return filename.toLowerCase().endsWith('.json');
    }
    static isXml(filename) {
        return filename.toLowerCase().endsWith('.xml');
    }
    static getNameFromPath(filePath) {
        return path.basename(filePath);
    }
    static getFolderFromPath(filePath) {
        const dir = path.dirname(filePath);
        return dir === '.' ? '' : dir;
    }
    /**
     * Sorts filenames naturally so that 'page2' comes before 'page10'
     */
    static naturalSort(a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    }
    /**
     * Kotlin parity: chaptersPages[index] = bookmark for each Page with Bookmark (withIndex).
     */
    static buildChaptersPagesFromComicInfo(info) {
        const out = {};
        const pages = info?.pages;
        if (!pages?.length)
            return out;
        for (let index = 0; index < pages.length; index++) {
            const bookmark = pages[index]?.bookmark?.trim();
            if (bookmark)
                out[index] = bookmark;
        }
        return out;
    }
    /**
     * Simple parser to convert ComicInfo.xml content to a ComicInfo object
     */
    static parseComicInfoXml(xmlContent) {
        try {
            const getTagValue = (tagName) => {
                const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
                const match = xmlContent.match(regex);
                return match ? match[1].trim() : '';
            };
            const getTagNumber = (tagName) => {
                const val = getTagValue(tagName);
                return val ? Number(val) : 0;
            };
            return {
                id: 0,
                title: getTagValue('Title'),
                series: getTagValue('Series'),
                number: getTagValue('Number'),
                summary: getTagValue('Summary'),
                writer: getTagValue('Writer'),
                penciller: getTagValue('Penciller'),
                inker: getTagValue('Inker'),
                colorist: getTagValue('Colorist'),
                letterer: getTagValue('Letterer'),
                coverArtist: getTagValue('CoverArtist'),
                editor: getTagValue('Editor'),
                publisher: getTagValue('Publisher'),
                genre: getTagValue('Genre'),
                web: getTagValue('Web'),
                pageCount: getTagNumber('PageCount'),
                languageISO: getTagValue('LanguageISO'),
                format: getTagValue('Format'),
                manga: getTagValue('Manga'),
                characters: getTagValue('Characters'),
                teams: getTagValue('Teams'),
                locations: getTagValue('Locations'),
                scanInformation: getTagValue('ScanInformation'),
                storyArc: getTagValue('StoryArc'),
                seriesGroup: getTagValue('SeriesGroup'),
                ageRating: getTagValue('AgeRating'),
                year: getTagNumber('Year'),
                month: getTagNumber('Month'),
                day: getTagNumber('Day'),
                pages: this.parseComicInfoPages(xmlContent)
            };
        }
        catch {
            return null;
        }
    }
    static parseComicInfoPages(xmlContent) {
        const pagesBlock = xmlContent.match(/<Pages\b[^>]*>([\s\S]*?)<\/Pages>/i);
        if (!pagesBlock)
            return [];
        const pages = [];
        const pageTagRe = /<Page\b([^>]*?)\/?>/gi;
        let match;
        while ((match = pageTagRe.exec(pagesBlock[1])) !== null) {
            const attrs = match[1] || '';
            const bookmark = this.getXmlAttr(attrs, 'Bookmark');
            const type = this.getXmlAttr(attrs, 'Type');
            const imageRaw = this.getXmlAttr(attrs, 'Image');
            const imageIndex = imageRaw !== '' && !Number.isNaN(Number(imageRaw)) ? Number(imageRaw) : pages.length;
            pages.push({
                imageIndex,
                ...(type ? { type } : {}),
                ...(bookmark ? { bookmark } : {})
            });
        }
        return pages;
    }
    static getXmlAttr(attrs, name) {
        const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
        const m = attrs.match(re);
        return (m?.[1] ?? m?.[2] ?? '').trim();
    }
}
exports.ParseUtil = ParseUtil;
