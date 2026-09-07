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
exports.pageFromCfi = pageFromCfi;
exports.cfiFromPage = cfiFromPage;
exports.clearAnnotationCfiCache = clearAnnotationCfiCache;
const fs = __importStar(require("fs"));
const url_1 = require("url");
const locationsCache = new Map();
const pendingLoads = new Map();
function loadEpubFactory() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('epubjs');
        return (mod?.default || mod);
    }
    catch (e) {
        console.warn('[annotation-cfi] epubjs unavailable in main:', e);
        return null;
    }
}
async function ensureLocations(bookPath) {
    if (!bookPath || !fs.existsSync(bookPath))
        return null;
    const cached = locationsCache.get(bookPath);
    if (cached)
        return cached;
    const pending = pendingLoads.get(bookPath);
    if (pending)
        return pending;
    const load = (async () => {
        const ePub = loadEpubFactory();
        if (!ePub)
            return null;
        try {
            const url = (0, url_1.pathToFileURL)(bookPath).href;
            const book = ePub(url);
            await book.ready;
            await book.locations.generate(1600);
            locationsCache.set(bookPath, book.locations);
            return book.locations;
        }
        catch (e) {
            console.warn('[annotation-cfi] failed to load locations for', bookPath, e);
            return null;
        }
        finally {
            pendingLoads.delete(bookPath);
        }
    })();
    pendingLoads.set(bookPath, load);
    return load;
}
function asLocationIndex(raw) {
    if (typeof raw === 'number' && !Number.isNaN(raw))
        return Math.max(0, Math.floor(raw));
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        if (!Number.isNaN(n))
            return Math.max(0, Math.floor(n));
    }
    return null;
}
/** Resolve epub.js location index from CFI; null on failure. */
async function pageFromCfi(bookPath, cfi) {
    if (!cfi?.trim())
        return null;
    const locations = await ensureLocations(bookPath);
    if (!locations)
        return null;
    try {
        return asLocationIndex(locations.locationFromCfi(cfi));
    }
    catch {
        return null;
    }
}
/** Approximate CFI from location index; null on failure. */
async function cfiFromPage(bookPath, page) {
    const locations = await ensureLocations(bookPath);
    if (!locations)
        return null;
    try {
        const len = Math.max(1, locations.length());
        const loc = Math.min(Math.max(0, page), len - 1);
        const cfi = locations.cfiFromLocation(loc);
        return typeof cfi === 'string' && cfi.trim() ? cfi : null;
    }
    catch {
        return null;
    }
}
function clearAnnotationCfiCache() {
    locationsCache.clear();
    pendingLoads.clear();
}
