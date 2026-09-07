import * as fs from 'fs';
import { pathToFileURL } from 'url';

type LocationsApi = {
  generate: (chars?: number) => Promise<unknown>;
  length: () => number;
  locationFromCfi: (cfi: string) => unknown;
  cfiFromLocation: (loc: number) => unknown;
};

type EpubBookApi = {
  ready: Promise<unknown>;
  locations: LocationsApi;
  destroy?: () => void;
};

type EpubFactory = (url: string) => EpubBookApi;

const locationsCache = new Map<string, LocationsApi>();
const pendingLoads = new Map<string, Promise<LocationsApi | null>>();

function loadEpubFactory(): EpubFactory | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('epubjs');
    return (mod?.default || mod) as EpubFactory;
  } catch (e) {
    console.warn('[annotation-cfi] epubjs unavailable in main:', e);
    return null;
  }
}

async function ensureLocations(bookPath: string): Promise<LocationsApi | null> {
  if (!bookPath || !fs.existsSync(bookPath)) return null;
  const cached = locationsCache.get(bookPath);
  if (cached) return cached;

  const pending = pendingLoads.get(bookPath);
  if (pending) return pending;

  const load = (async (): Promise<LocationsApi | null> => {
    const ePub = loadEpubFactory();
    if (!ePub) return null;
    try {
      const url = pathToFileURL(bookPath).href;
      const book = ePub(url);
      await book.ready;
      await book.locations.generate(1600);
      locationsCache.set(bookPath, book.locations);
      return book.locations;
    } catch (e) {
      console.warn('[annotation-cfi] failed to load locations for', bookPath, e);
      return null;
    } finally {
      pendingLoads.delete(bookPath);
    }
  })();

  pendingLoads.set(bookPath, load);
  return load;
}

function asLocationIndex(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

/** Resolve epub.js location index from CFI; null on failure. */
export async function pageFromCfi(bookPath: string, cfi: string): Promise<number | null> {
  if (!cfi?.trim()) return null;
  const locations = await ensureLocations(bookPath);
  if (!locations) return null;
  try {
    return asLocationIndex(locations.locationFromCfi(cfi));
  } catch {
    return null;
  }
}

/** Approximate CFI from location index; null on failure. */
export async function cfiFromPage(bookPath: string, page: number): Promise<string | null> {
  const locations = await ensureLocations(bookPath);
  if (!locations) return null;
  try {
    const len = Math.max(1, locations.length());
    const loc = Math.min(Math.max(0, page), len - 1);
    const cfi = locations.cfiFromLocation(loc);
    return typeof cfi === 'string' && cfi.trim() ? cfi : null;
  } catch {
    return null;
  }
}

export function clearAnnotationCfiCache(): void {
  locationsCache.clear();
  pendingLoads.clear();
}
