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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpubBookExtractor = void 0;
const adm_zip_1 = __importDefault(require("adm-zip"));
const path = __importStar(require("path"));
class EpubBookExtractor {
    static extractMetadata(filePath) {
        let title = '';
        let author = '';
        let series = '';
        let genre = '';
        let publisher = '';
        let language = '';
        let coverImage = null;
        try {
            const zip = new adm_zip_1.default(filePath);
            const containerEntry = zip.getEntry('META-INF/container.xml');
            let opfPath = '';
            if (containerEntry) {
                const containerXml = zip.readAsText(containerEntry);
                const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
                if (rootfileMatch) {
                    opfPath = rootfileMatch[1];
                }
            }
            if (!opfPath) {
                // Fallback: search for any .opf file in the zip
                const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
                if (opfEntries.length > 0) {
                    opfPath = opfEntries[0].entryName;
                }
            }
            if (opfPath) {
                const opfEntry = zip.getEntry(opfPath);
                if (opfEntry) {
                    const opfXml = zip.readAsText(opfEntry);
                    const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
                    if (titleMatch)
                        title = this.cleanXmlText(titleMatch[1]);
                    const creatorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
                    if (creatorMatch)
                        author = this.cleanXmlText(creatorMatch[1]);
                    const publisherMatch = opfXml.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
                    if (publisherMatch)
                        publisher = this.cleanXmlText(publisherMatch[1]);
                    const langMatch = opfXml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
                    if (langMatch)
                        language = this.cleanXmlText(langMatch[1]);
                    const subjectMatch = opfXml.match(/<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/i);
                    if (subjectMatch)
                        genre = this.cleanXmlText(subjectMatch[1]);
                    // Extract Cover Image
                    const coverMetaMatch = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
                        opfXml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
                    let coverItemId = coverMetaMatch ? coverMetaMatch[1] : '';
                    let coverHref = '';
                    if (coverItemId) {
                        const itemMatch = opfXml.match(new RegExp(`<item[^>]*id=["']${coverItemId}["'][^>]*href=["']([^"']+)["']`, 'i')) ||
                            opfXml.match(new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*id=["']${coverItemId}["']`, 'i'));
                        if (itemMatch) {
                            coverHref = itemMatch[1];
                        }
                    }
                    if (!coverHref) {
                        // Fallback: look for item with media-type image and 'cover' in id or href
                        const coverItemMatch = opfXml.match(/<item[^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["'][^>]*media-type=["']image\/[^"']+["']/i) ||
                            opfXml.match(/<item[^>]*media-type=["']image\/[^"']+["'][^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["']/i);
                        if (coverItemMatch) {
                            coverHref = coverItemMatch[1];
                        }
                    }
                    if (coverHref) {
                        const opfDir = path.dirname(opfPath);
                        const fullCoverPath = opfDir === '.' ? coverHref : path.posix.join(opfDir.replace(/\\/g, '/'), coverHref);
                        const coverEntry = zip.getEntry(fullCoverPath) || zip.getEntry(coverHref);
                        if (coverEntry) {
                            coverImage = zip.readFile(coverEntry);
                        }
                    }
                }
            }
        }
        catch (e) {
            console.warn(`Error reading EPUB metadata for ${filePath}:`, e);
        }
        return {
            title,
            author,
            series,
            genre,
            publisher,
            language,
            coverImage
        };
    }
    static cleanXmlText(text) {
        return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    }
}
exports.EpubBookExtractor = EpubBookExtractor;
