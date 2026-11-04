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
const fs = __importStar(require("fs"));
class EpubBookExtractor {
    static extractMetadata(filePath) {
        let title = '';
        let author = '';
        let series = '';
        let genre = '';
        let publisher = '';
        let language = '';
        let isbn = '';
        let annotation = '';
        let tags = '';
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
                    const creators = [];
                    const creatorRegex = /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/gi;
                    let cMatch;
                    while ((cMatch = creatorRegex.exec(opfXml)) !== null) {
                        const c = this.cleanXmlText(cMatch[1]);
                        if (c && !creators.includes(c))
                            creators.push(c);
                    }
                    if (creators.length > 0)
                        author = creators.join(', ');
                    const publisherMatch = opfXml.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
                    if (publisherMatch)
                        publisher = this.cleanXmlText(publisherMatch[1]);
                    const langMatch = opfXml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
                    if (langMatch)
                        language = this.cleanXmlText(langMatch[1]);
                    const descMatch = opfXml.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
                    if (descMatch)
                        annotation = this.cleanXmlText(descMatch[1]);
                    const isbnMatch = opfXml.match(/<dc:identifier[^>]*>(?:(?:urn:)?isbn:)\s*([0-9Xx-]{10,17})<\/dc:identifier>/i) ||
                        opfXml.match(/<dc:identifier[^>]*(?:scheme=["']ISBN["']|id=["'][^"']*isbn[^"']*["'])[^>]*>([\s\S]*?)<\/dc:identifier>/i) ||
                        opfXml.match(/<dc:identifier[^>]*>(?:urn:isbn:)?([0-9Xx-]{10,17})<\/dc:identifier>/i);
                    if (isbnMatch)
                        isbn = this.cleanXmlText(isbnMatch[1]).replace(/^(?:urn:)?isbn:\s*/i, '').trim();
                    // Series from Calibre metadata or EPUB 3 belongs-to-collection (including opf:meta prefix)
                    const seriesMatch = opfXml.match(/<(?:opf:)?meta\s+name=["']calibre:series["']\s+content=["']([^"']+)["']/i) ||
                        opfXml.match(/<(?:opf:)?meta\s+property=["']belongs-to-collection["'][^>]*>([\s\S]*?)<\/(?:opf:)?meta>/i);
                    if (seriesMatch)
                        series = this.cleanXmlText(seriesMatch[1]);
                    // Subjects / Tags
                    const subjects = [];
                    const subjectRegex = /<dc:subject[^>]*>([\s\S]*?)<\/dc:subject>/gi;
                    let subMatch;
                    while ((subMatch = subjectRegex.exec(opfXml)) !== null) {
                        const cleanSub = this.cleanXmlText(subMatch[1]);
                        if (cleanSub)
                            subjects.push(cleanSub);
                    }
                    if (subjects.length > 0) {
                        genre = subjects[0];
                        tags = subjects.join(', ');
                    }
                    const coverHref = this.resolveCoverHref(opfXml);
                    if (coverHref) {
                        coverImage = this.readZipImage(zip, opfPath, coverHref);
                    }
                }
            }
            // ZIP filename fallback (Kotlin-aligned): cover*.jpg/png when OPF resolution fails
            if (!coverImage) {
                coverImage = this.findCoverByZipFilename(zip);
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
            isbn,
            annotation,
            tags,
            coverImage
        };
    }
    /** Escape a string for safe use inside a RegExp pattern. */
    static escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Resolve cover image href from OPF:
     * 1) meta name=cover content → item id
     * 2) meta content → item properties (Yen Press: content="cover-image" but id differs)
     * 3) item with properties containing cover-image
     * 4) image item whose href contains cover / cover-image
     */
    static resolveCoverHref(opfXml) {
        const coverMetaMatch = opfXml.match(/<meta[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i) ||
            opfXml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']cover["']/i);
        const coverRef = coverMetaMatch ? coverMetaMatch[1] : '';
        if (coverRef) {
            const escaped = this.escapeRegExp(coverRef);
            // Match item by id === meta content
            const byId = opfXml.match(new RegExp(`<item[^>]*id=["']${escaped}["'][^>]*href=["']([^"']+)["']`, 'i')) ||
                opfXml.match(new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*id=["']${escaped}["']`, 'i'));
            if (byId?.[1]) {
                return byId[1];
            }
            // Match item by properties === meta content (e.g. properties="cover-image")
            const byExactProp = opfXml.match(new RegExp(`<item[^>]*properties=["']${escaped}["'][^>]*href=["']([^"']+)["']`, 'i')) ||
                opfXml.match(new RegExp(`<item[^>]*href=["']([^"']+)["'][^>]*properties=["']${escaped}["']`, 'i'));
            if (byExactProp?.[1]) {
                return byExactProp[1];
            }
        }
        // EPUB3: properties contains cover-image (may be space-separated with other props)
        const byCoverProp = opfXml.match(/<item[^>]*properties=["'][^"']*\bcover-image\b[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
            opfXml.match(/<item[^>]*href=["']([^"']+)["'][^>]*properties=["'][^"']*\bcover-image\b[^"']*["']/i);
        if (byCoverProp?.[1]) {
            return byCoverProp[1];
        }
        // Fallback: image item with 'cover' / 'cover-image' in href
        const byHref = opfXml.match(/<item[^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["'][^>]*media-type=["']image\/[^"']+["']/i) ||
            opfXml.match(/<item[^>]*media-type=["']image\/[^"']+["'][^>]*href=["']([^"']*(?:cover|cover-image)[^"']*)["']/i);
        if (byHref?.[1]) {
            return byHref[1];
        }
        return '';
    }
    static readZipImage(zip, opfPath, coverHref) {
        const decodedHref = (() => {
            try {
                return decodeURIComponent(coverHref);
            }
            catch {
                return coverHref;
            }
        })();
        const opfDir = path.dirname(opfPath).replace(/\\/g, '/');
        const fullCoverPath = opfDir === '.' ? decodedHref : path.posix.join(opfDir, decodedHref);
        let coverEntry = zip.getEntry(fullCoverPath) || zip.getEntry(decodedHref) || zip.getEntry(coverHref);
        if (!coverEntry) {
            const basename = decodedHref.includes('/')
                ? decodedHref.substring(decodedHref.lastIndexOf('/') + 1)
                : decodedHref;
            coverEntry =
                zip.getEntries().find(e => !e.isDirectory && e.entryName.includes(decodedHref)) ||
                    zip.getEntries().find(e => !e.isDirectory && e.entryName.endsWith('/' + basename)) ||
                    zip.getEntries().find(e => !e.isDirectory && e.entryName.endsWith(basename)) ||
                    null;
        }
        if (coverEntry) {
            return zip.readFile(coverEntry);
        }
        return null;
    }
    /** Prefer basename starting with "cover", else any image basename containing "cover". */
    static findCoverByZipFilename(zip) {
        const imageExt = /\.(jpe?g|png)$/i;
        let coverAux = null;
        for (const entry of zip.getEntries()) {
            if (entry.isDirectory)
                continue;
            const name = entry.entryName.replace(/\\/g, '/');
            const basename = name.includes('/') ? name.substring(name.lastIndexOf('/') + 1) : name;
            if (!imageExt.test(basename))
                continue;
            const low = basename.toLowerCase();
            if (low.startsWith('cover')) {
                return zip.readFile(entry);
            }
            if (coverAux === null && low.includes('cover')) {
                coverAux = zip.readFile(entry);
            }
        }
        return coverAux;
    }
    static cleanXmlText(text) {
        return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    }
    /**
     * Count total words in an EPUB file (or in a specified spine/page range if applicable).
     */
    static countWords(filePath, pageStart, pageEnd) {
        try {
            if (!filePath || !fs.existsSync(filePath))
                return 0;
            const zip = new adm_zip_1.default(filePath);
            let opfPath = '';
            const containerEntry = zip.getEntry('META-INF/container.xml');
            if (containerEntry) {
                const containerXml = zip.readAsText(containerEntry);
                const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
                if (rootfileMatch) {
                    opfPath = rootfileMatch[1];
                }
            }
            if (!opfPath) {
                const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
                if (opfEntries.length > 0)
                    opfPath = opfEntries[0].entryName;
            }
            const opfDir = opfPath ? path.dirname(opfPath).replace(/\\/g, '/') : '';
            let spineHrefs = [];
            if (opfPath) {
                const opfEntry = zip.getEntry(opfPath);
                if (opfEntry) {
                    const opfXml = zip.readAsText(opfEntry);
                    const manifestItems = {};
                    const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
                    let match;
                    while ((match = itemRegex.exec(opfXml)) !== null) {
                        manifestItems[match[1]] = match[2];
                    }
                    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
                    while ((match = spineRegex.exec(opfXml)) !== null) {
                        const idref = match[1];
                        if (manifestItems[idref]) {
                            const href = manifestItems[idref];
                            const fullHref = opfDir && opfDir !== '.' ? path.posix.join(opfDir, href) : href;
                            spineHrefs.push(fullHref);
                        }
                    }
                }
            }
            // Fallback: extract all html/xhtml entries in zip
            if (spineHrefs.length === 0) {
                spineHrefs = zip.getEntries()
                    .filter(e => !e.isDirectory && /\.(x?html|xml|htm)$/i.test(e.entryName))
                    .map(e => e.entryName);
            }
            if (spineHrefs.length === 0)
                return 0;
            // Filter by page/spine range if provided (1-based)
            if (pageStart != null && pageEnd != null && pageStart > 0 && pageEnd >= pageStart) {
                const startIdx = Math.max(0, pageStart - 1);
                const endIdx = Math.min(spineHrefs.length, pageEnd);
                spineHrefs = spineHrefs.slice(startIdx, endIdx);
            }
            let totalWords = 0;
            for (const href of spineHrefs) {
                const decodedHref = decodeURIComponent(href);
                const entry = zip.getEntry(decodedHref) || zip.getEntry(href);
                if (!entry)
                    continue;
                const content = zip.readAsText(entry);
                // Remove style and script tags and their content
                const stripped = content
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                    .replace(/<rt\b[^<]*(?:(?!<\/rt>)<[^<]*)*<\/rt>/gi, ' ') // Furigana rt tags
                    .replace(/<[^>]+>/g, ' ');
                const text = stripped
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .trim();
                if (!text)
                    continue;
                // Check for CJK characters
                const cjkMatches = text.match(/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/g);
                if (cjkMatches && cjkMatches.length > text.length * 0.3) {
                    // Primarily CJK: count characters
                    totalWords += cjkMatches.length;
                }
                else {
                    // Western text: count words
                    const words = text.split(/\s+/).filter(w => w.length > 0);
                    totalWords += words.length;
                }
            }
            return totalWords;
        }
        catch (e) {
            console.warn(`Error counting words in EPUB ${filePath}:`, e);
            return 0;
        }
    }
    /**
     * Calculate total page/spine count for an EPUB file.
     */
    static calculatePages(filePath) {
        try {
            if (!filePath || !fs.existsSync(filePath))
                return 0;
            const zip = new adm_zip_1.default(filePath);
            let opfPath = '';
            const containerEntry = zip.getEntry('META-INF/container.xml');
            if (containerEntry) {
                const containerXml = zip.readAsText(containerEntry);
                const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
                if (rootfileMatch) {
                    opfPath = rootfileMatch[1];
                }
            }
            if (!opfPath) {
                const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
                if (opfEntries.length > 0)
                    opfPath = opfEntries[0].entryName;
            }
            if (opfPath) {
                const opfEntry = zip.getEntry(opfPath);
                if (opfEntry) {
                    const opfXml = zip.readAsText(opfEntry);
                    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
                    let count = 0;
                    while (spineRegex.exec(opfXml) !== null) {
                        count++;
                    }
                    if (count > 0)
                        return count;
                }
            }
            // Fallback: count html/xhtml files
            const htmlEntries = zip.getEntries().filter(e => !e.isDirectory && /\.(x?html|xml|htm)$/i.test(e.entryName));
            return htmlEntries.length;
        }
        catch (e) {
            console.warn(`Error calculating pages in EPUB ${filePath}:`, e);
            return 0;
        }
    }
    /**
     * Extract chapters/table of contents from an EPUB file (NCX, EPUB 3 Nav, or Spine fallback).
     */
    static extractChapters(filePath) {
        try {
            if (!filePath || !fs.existsSync(filePath))
                return [];
            const zip = new adm_zip_1.default(filePath);
            let opfPath = '';
            const containerEntry = zip.getEntry('META-INF/container.xml');
            if (containerEntry) {
                const containerXml = zip.readAsText(containerEntry);
                const rootfileMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
                if (rootfileMatch) {
                    opfPath = rootfileMatch[1];
                }
            }
            if (!opfPath) {
                const opfEntries = zip.getEntries().filter(e => e.entryName.endsWith('.opf'));
                if (opfEntries.length > 0)
                    opfPath = opfEntries[0].entryName;
            }
            if (!opfPath)
                return [];
            const opfEntry = zip.getEntry(opfPath);
            if (!opfEntry)
                return [];
            const opfXml = zip.readAsText(opfEntry);
            const opfDir = path.dirname(opfPath).replace(/\\/g, '/');
            const resolveZipEntry = (relPath) => {
                const clean = relPath.split('#')[0].split('?')[0];
                const normalized = opfDir && opfDir !== '.' ? path.posix.join(opfDir, clean) : clean;
                return path.posix.normalize(normalized);
            };
            const chapters = [];
            // 1. Try EPUB 2 NCX file
            let ncxHref = '';
            const ncxMatch = opfXml.match(/<item\s+[^>]*media-type=["']application\/x-dtbncx\+xml["'][^>]*href=["']([^"']+)["']/i) ||
                opfXml.match(/<item\s+[^>]*href=["']([^"']+)["'][^>]*media-type=["']application\/x-dtbncx\+xml["']/i);
            if (ncxMatch) {
                ncxHref = ncxMatch[1];
            }
            else {
                const spineTocMatch = opfXml.match(/<spine\s+[^>]*toc=["']([^"']+)["']/i);
                if (spineTocMatch) {
                    const tocId = spineTocMatch[1];
                    const itemMatch = opfXml.match(new RegExp(`<item\\s+[^>]*id=["']${this.escapeRegExp(tocId)}["'][^>]*href=["']([^"']+)["']`, 'i'));
                    if (itemMatch)
                        ncxHref = itemMatch[1];
                }
            }
            if (ncxHref) {
                const ncxPath = resolveZipEntry(ncxHref);
                const ncxEntry = zip.getEntry(ncxPath) || zip.getEntry(decodeURIComponent(ncxPath));
                if (ncxEntry) {
                    const ncxXml = zip.readAsText(ncxEntry);
                    const navPointRegex = /<navPoint\b[\s\S]*?<\/navPoint>/gi;
                    let npMatch;
                    while ((npMatch = navPointRegex.exec(ncxXml)) !== null) {
                        const block = npMatch[0];
                        const textMatch = block.match(/<navLabel>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>/i);
                        const srcMatch = block.match(/<content\s+[^>]*src=["']([^"']+)["']/i);
                        const label = textMatch ? this.cleanXmlText(textMatch[1]) : '';
                        const href = srcMatch ? srcMatch[1].trim() : '';
                        if (label) {
                            chapters.push({
                                index: chapters.length,
                                label,
                                href
                            });
                        }
                    }
                }
            }
            // 2. Try EPUB 3 Navigation Document if NCX produced no chapters
            if (chapters.length === 0) {
                const navMatch = opfXml.match(/<item\s+[^>]*properties=["'][^"']*\bnav\b[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                    opfXml.match(/<item\s+[^>]*href=["']([^"']+)["'][^>]*properties=["'][^"']*\bnav\b[^"']*["']/i);
                if (navMatch) {
                    const navPath = resolveZipEntry(navMatch[1]);
                    const navEntry = zip.getEntry(navPath) || zip.getEntry(decodeURIComponent(navPath));
                    if (navEntry) {
                        const navXml = zip.readAsText(navEntry);
                        const tocNavMatch = navXml.match(/<nav\b[^>]*(?:epub:type=["']toc["']|id=["']toc["'])[\s\S]*?<\/nav>/i) ||
                            navXml.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i);
                        const navBlock = tocNavMatch ? tocNavMatch[0] : navXml;
                        const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
                        let aMatch;
                        while ((aMatch = aRegex.exec(navBlock)) !== null) {
                            const href = aMatch[1].trim();
                            const label = this.cleanXmlText(aMatch[2]);
                            if (label) {
                                chapters.push({
                                    index: chapters.length,
                                    label,
                                    href
                                });
                            }
                        }
                    }
                }
            }
            // 3. Fallback: Spine items if still 0 chapters
            if (chapters.length === 0) {
                const itemMap = new Map();
                const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi;
                let itMatch;
                while ((itMatch = itemRegex.exec(opfXml)) !== null) {
                    itemMap.set(itMatch[1], itMatch[2]);
                }
                const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*>/gi;
                let spMatch;
                let spineIdx = 0;
                while ((spMatch = spineRegex.exec(opfXml)) !== null) {
                    const idref = spMatch[1];
                    const href = itemMap.get(idref) || '';
                    chapters.push({
                        index: spineIdx,
                        label: `Capítulo ${spineIdx + 1}`,
                        href,
                        page: spineIdx
                    });
                    spineIdx++;
                }
            }
            // Deduplicate consecutive identical entries
            const deduped = [];
            for (const ch of chapters) {
                const prev = deduped[deduped.length - 1];
                if (prev && prev.label === ch.label && prev.href === ch.href) {
                    continue;
                }
                deduped.push({
                    ...ch,
                    index: deduped.length
                });
            }
            return deduped;
        }
        catch (e) {
            console.warn(`Error extracting chapters from EPUB ${filePath}:`, e);
            return [];
        }
    }
}
exports.EpubBookExtractor = EpubBookExtractor;
