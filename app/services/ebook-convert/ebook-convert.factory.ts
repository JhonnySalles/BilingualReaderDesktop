import * as fs from 'fs';
import * as path from 'path';
import {
  AdapterStatus,
  EbookConversionError,
  EbookConvertMode,
  EbookConverterAdapter,
  NATIVE_CONVERTER_IDS,
  normalizeExt
} from './types';
import { PassthroughAdapter } from './adapters/passthrough.adapter';
import { PandocCliAdapter } from './adapters/pandoc.adapter';
import { CalibreCliAdapter } from './adapters/calibre.adapter';
import { DocumentJsAdapter } from './adapters/document-js.adapter';
import { LibmobiAdapter } from './adapters/libmobi.adapter';
import { Fb2Adapter } from './adapters/fb2.adapter';

/**
 * Selects and runs ebook converters by extension and preferred mode.
 * Tries the next available adapter on conversion_failed (not DRM).
 */
export class EbookConvertFactory {
  private readonly adapters: EbookConverterAdapter[];
  private readonly pandoc: PandocCliAdapter;
  private readonly calibre: CalibreCliAdapter;
  private readonly libmobi: LibmobiAdapter;
  private readonly documentJs: DocumentJsAdapter;
  private readonly fb2: Fb2Adapter;
  private readonly passthrough: PassthroughAdapter;

  constructor() {
    this.passthrough = new PassthroughAdapter();
    this.libmobi = new LibmobiAdapter();
    this.documentJs = new DocumentJsAdapter();
    this.fb2 = new Fb2Adapter();
    this.pandoc = new PandocCliAdapter();
    this.calibre = new CalibreCliAdapter();
    this.adapters = [
      this.passthrough,
      this.libmobi,
      this.documentJs,
      this.fb2,
      this.pandoc,
      this.calibre
    ];
  }

  public getAdapters(): EbookConverterAdapter[] {
    return [...this.adapters];
  }

  public getAdapterStatuses(): AdapterStatus[] {
    return this.adapters.map(a => {
      const available = a.isAvailable();
      let detail: string | null = null;
      if (a.id === 'pandoc') detail = this.pandoc.getBinaryPath();
      if (a.id === 'calibre') detail = this.calibre.getBinaryPath();
      if (a.id === 'libmobi') detail = available ? 'addon carregado' : 'addon indisponível';
      if (a.id === 'document-js') detail = 'embutido';
      if (a.id === 'fb2') detail = available ? 'parser embutido' : 'indisponível';
      if (a.id === 'passthrough') detail = 'sempre';
      return { id: a.id, label: a.label, available, detail };
    });
  }

  public clearCliCaches(): void {
    this.pandoc.clearCache();
    this.calibre.clearCache();
  }

  /**
   * Convert input to EPUB at outputEpubPath.
   * Mode: auto = Calibre then native; calibre = Calibre only; native = builtin only.
   * Passthrough remains eligible in every mode for EPUB-like inputs.
   */
  public async convert(
    inputPath: string,
    outputEpubPath: string,
    mode: EbookConvertMode = 'auto'
  ): Promise<void> {
    if (!fs.existsSync(inputPath)) {
      throw new EbookConversionError(`Arquivo não encontrado: ${inputPath}`, 'not_found');
    }

    const ext = normalizeExt(inputPath);
    const eligible = this.adapters.filter(a => a.canHandle(ext) && a.isAvailable());
    const candidates = this.orderCandidates(eligible, mode);

    if (candidates.length === 0) {
      throw this.emptyCandidatesError(ext, mode);
    }

    let lastError = '';
    for (const adapter of candidates) {
      try {
        if (fs.existsSync(outputEpubPath) && adapter.id !== 'passthrough') {
          try {
            fs.unlinkSync(outputEpubPath);
          } catch {
            /* ignore */
          }
        }
        await adapter.convert(inputPath, outputEpubPath);
        if (fs.existsSync(outputEpubPath) && fs.statSync(outputEpubPath).size > 0) {
          return;
        }
        lastError = `${adapter.label} não gerou EPUB válido`;
      } catch (e) {
        if (e instanceof EbookConversionError && e.code === 'drm') {
          throw e;
        }
        lastError = e instanceof Error ? e.message : String(e);
        if (/drm|encryption|encrypted|kindle/i.test(lastError)) {
          throw new EbookConversionError(
            'Não foi possível converter este arquivo (possível DRM/proteção). Remova a proteção ou use um EPUB sem DRM.',
            'drm'
          );
        }
      }
    }

    throw new EbookConversionError(
      `Falha ao converter para EPUB: ${path.basename(inputPath)}. ${lastError}`.trim(),
      'conversion_failed'
    );
  }

  /** Exposed for smoke tests. */
  public orderCandidates(
    eligible: EbookConverterAdapter[],
    mode: EbookConvertMode
  ): EbookConverterAdapter[] {
    const byPriority = (a: EbookConverterAdapter, b: EbookConverterAdapter) =>
      b.priority - a.priority;

    const passthrough = eligible.filter(a => a.id === 'passthrough').sort(byPriority);
    const calibre = eligible.filter(a => a.id === 'calibre');
    const natives = eligible
      .filter(a => NATIVE_CONVERTER_IDS.has(a.id) && a.id !== 'passthrough')
      .sort(byPriority);

    if (mode === 'calibre') {
      return [...passthrough, ...calibre];
    }
    if (mode === 'native') {
      return [...passthrough, ...natives];
    }
    // auto: Calibre first, then native (Pandoc excluded)
    return [...passthrough, ...calibre, ...natives];
  }

  private emptyCandidatesError(ext: string, mode: EbookConvertMode): EbookConversionError {
    if (mode === 'calibre') {
      if (!this.calibre.isAvailable()) {
        return new EbookConversionError(
          'Modo Calibre selecionado, mas o Calibre (ebook-convert) não foi encontrado. Instale o Calibre ou altere o modo de conversão para Auto/Nativo.',
          'missing_tools'
        );
      }
      return new EbookConversionError(
        `Formato ${ext || '(desconhecido)'} não é suportado pelo Calibre neste modo.`,
        'unsupported'
      );
    }

    if (mode === 'native') {
      const hint =
        ext === '.pdf' || ext === '.djvu'
          ? ' PDF/DJVU exigem Calibre — altere o modo para Auto ou Calibre.'
          : '';
      return new EbookConversionError(
        `Formato ${ext || '(desconhecido)'} não é suportado pelos converters nativos.${hint}`,
        'unsupported'
      );
    }

    const anyNative =
      this.libmobi.isAvailable() || this.documentJs.isAvailable() || this.fb2.isAvailable();
    if (!this.calibre.isAvailable() && !anyNative && !this.passthrough.canHandle(ext)) {
      return new EbookConversionError(
        'Nenhuma ferramenta de conversão encontrada. Instale o Calibre (ebook-convert) ou use formatos suportados nativamente (EPUB, TXT, MD, HTML, DOCX, MOBI sem DRM, FB2).',
        'missing_tools'
      );
    }
    const hint =
      ext === '.pdf' || ext === '.djvu'
        ? ' Instale o Calibre para converter PDF/DJVU.'
        : '';
    return new EbookConversionError(
      `Formato ${ext || '(desconhecido)'} não é suportado pelos adapters disponíveis.${hint}`,
      'unsupported'
    );
  }
}
