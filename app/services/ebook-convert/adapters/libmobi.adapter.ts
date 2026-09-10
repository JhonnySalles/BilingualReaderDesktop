import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  EbookConverterAdapter,
  EbookConversionError,
  EbookIr
} from '../types';
import { EpubPacker } from '../epub-packer';

const EXTS = new Set(['.mobi', '.prc', '.azw', '.azw3']);

interface LibmobiNative {
  parseToIr(inputPath: string): {
    title: string;
    author?: string;
    language?: string;
    chapters: Array<{ id: string; title: string; html: string }>;
    assets: Array<{ href: string; mediaType: string; data: Buffer | string }>;
    drm?: boolean;
  };
}

/**
 * Native libmobi (N-API) → IR → EPUB. Unavailable when the addon is not built.
 */
export class LibmobiAdapter implements EbookConverterAdapter {
  readonly id = 'libmobi' as const;
  readonly label = 'libmobi (nativo)';
  readonly priority = 90;
  private native: LibmobiNative | null | undefined;

  isAvailable(): boolean {
    return !!this.loadNative();
  }

  canHandle(ext: string): boolean {
    return EXTS.has(ext.toLowerCase());
  }

  async convert(inputPath: string, outputEpubPath: string): Promise<void> {
    const native = this.loadNative();
    if (!native) {
      throw new EbookConversionError('Addon libmobi indisponível', 'missing_tools');
    }

    let parsed: ReturnType<LibmobiNative['parseToIr']>;
    try {
      parsed = native.parseToIr(inputPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/drm|encrypt/i.test(msg)) {
        throw new EbookConversionError(
          'Não foi possível converter este arquivo (possível DRM/proteção). Remova a proteção ou use um EPUB sem DRM.',
          'drm'
        );
      }
      throw new EbookConversionError(msg, 'conversion_failed');
    }

    if (parsed.drm) {
      throw new EbookConversionError(
        'Não foi possível converter este arquivo (possível DRM/proteção). Remova a proteção ou use um EPUB sem DRM.',
        'drm'
      );
    }

    const ir: EbookIr = {
      title: parsed.title || path.basename(inputPath),
      author: parsed.author,
      language: parsed.language || 'und',
      chapters: (parsed.chapters || []).map((c, i) => ({
        id: c.id || `c${i + 1}`,
        title: c.title || `Capítulo ${i + 1}`,
        html: c.html || '<p></p>'
      })),
      assets: (parsed.assets || []).map(a => ({
        href: a.href,
        mediaType: a.mediaType,
        data: Buffer.isBuffer(a.data)
          ? a.data
          : Buffer.from(String(a.data), 'base64')
      }))
    };

    if (!ir.chapters.length) {
      throw new EbookConversionError('libmobi não extraiu capítulos', 'conversion_failed');
    }

    EpubPacker.write(ir, outputEpubPath);
  }

  private loadNative(): LibmobiNative | null {
    if (this.native !== undefined) return this.native;

    const candidates = this.candidatePaths();
    for (const candidate of candidates) {
      try {
        if (!fs.existsSync(candidate)) continue;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(candidate);
        if (mod && typeof mod.parseToIr === 'function') {
          this.native = mod as LibmobiNative;
          return this.native;
        }
        if (mod?.default && typeof mod.default.parseToIr === 'function') {
          this.native = mod.default as LibmobiNative;
          return this.native;
        }
      } catch {
        /* try next */
      }
    }
    this.native = null;
    return null;
  }

  private candidatePaths(): string[] {
    const roots: string[] = [];
    try {
      if (app?.getAppPath) roots.push(app.getAppPath());
    } catch {
      /* not ready */
    }
    if (process.resourcesPath) roots.push(process.resourcesPath);
    roots.push(process.cwd());
    // dist-electron/app/services/ebook-convert/adapters → repo root
    roots.push(path.join(__dirname, '..', '..', '..', '..', '..'));
    // dist-electron → repo root
    roots.push(path.join(__dirname, '..', '..', '..', '..'));

    const rels = [
      path.join('native', 'libmobi-addon', 'build', 'Release', 'libmobi_addon.node'),
      path.join('native', 'libmobi-addon', 'build', 'Debug', 'libmobi_addon.node'),
      path.join('native', 'libmobi-addon', 'index.js'),
      path.join('app.asar.unpacked', 'native', 'libmobi-addon', 'build', 'Release', 'libmobi_addon.node'),
      path.join('libmobi_addon.node')
    ];

    const out: string[] = [];
    for (const root of roots) {
      for (const rel of rels) {
        out.push(path.join(root, rel));
      }
    }
    return out;
  }
}
