import * as fs from 'fs';
import * as path from 'path';
import {
  EbookConverterAdapter,
  EbookConversionError,
  EbookIr,
  escapeHtml,
  escapeXml
} from '../types';
import { EpubPacker } from '../epub-packer';

const EXTS = new Set(['.fb2']);

/**
 * FictionBook 2 → IR → EPUB (TypeScript XML extract, no Calibre required).
 */
export class Fb2Adapter implements EbookConverterAdapter {
  readonly id = 'fb2' as const;
  readonly label = 'FictionBook (FB2)';
  readonly priority = 75;

  isAvailable(): boolean {
    return true;
  }

  canHandle(ext: string): boolean {
    return EXTS.has(ext.toLowerCase());
  }

  async convert(inputPath: string, outputEpubPath: string): Promise<void> {
    const raw = fs.readFileSync(inputPath);
    let xml = raw.toString('utf-8');
    if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
    // UTF-16 LE BOM
    if (raw[0] === 0xff && raw[1] === 0xfe) {
      xml = raw.toString('utf16le');
      if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
    }

    const ir = this.parseFb2(xml, path.basename(inputPath, '.fb2'));
    EpubPacker.write(ir, outputEpubPath);
  }

  private parseFb2(xml: string, fallbackTitle: string): EbookIr {
    const title =
      this.textOf(xml, 'book-title') ||
      this.textOf(xml, 'title') ||
      fallbackTitle;
    const firstName = this.textOf(xml, 'first-name') || '';
    const lastName = this.textOf(xml, 'last-name') || '';
    const author =
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      this.textOf(xml, 'nickname') ||
      undefined;
    const language = this.textOf(xml, 'lang') || 'und';

    const bodyMatch = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) {
      throw new EbookConversionError('FB2 sem elemento body', 'conversion_failed');
    }
    const body = bodyMatch[1];
    const sections = [...body.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
    const chapters =
      sections.length > 0
        ? sections.map((m, i) => this.sectionToChapter(m[1], i))
        : [this.sectionToChapter(body, 0)];

    const { assets, idToHref } = this.extractBinaries(xml);
    const chaptersFixed = chapters.map(ch => ({
      ...ch,
      html: ch.html.replace(
        /src="([^"]+)"/g,
        (_all, id: string) => `src="${idToHref.get(id) || id}"`
      )
    }));

    return { title, author, language, chapters: chaptersFixed, assets };
  }

  private sectionToChapter(sectionXml: string, index: number): EbookIr['chapters'][0] {
    const title =
      this.textOf(sectionXml, 'title') ||
      this.textOf(sectionXml, 'subtitle') ||
      `Capítulo ${index + 1}`;
    let html = sectionXml
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
      .replace(/<subtitle\b[^>]*>[\s\S]*?<\/subtitle>/gi, '')
      .replace(/<empty-line\s*\/?>/gi, '<br/>')
      .replace(/<emphasis>([\s\S]*?)<\/emphasis>/gi, '<em>$1</em>')
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, '<strong>$1</strong>')
      .replace(/<poem\b[^>]*>/gi, '<blockquote>')
      .replace(/<\/poem>/gi, '</blockquote>')
      .replace(/<stanza\b[^>]*>/gi, '<p>')
      .replace(/<\/stanza>/gi, '</p>')
      .replace(/<v>([\s\S]*?)<\/v>/gi, '$1<br/>')
      .replace(/<image\s+[^>]*l:href="#([^"]+)"[^>]*\/?>/gi, '<img src="$1" alt=""/>')
      .replace(/<image\s+[^>]*xlink:href="#([^"]+)"[^>]*\/?>/gi, '<img src="$1" alt=""/>')
      .replace(/<p\b[^>]*>/gi, '<p>')
      .replace(/<\/?section\b[^>]*>/gi, '');

    // Strip remaining unknown FB2 tags while keeping text
    html = html.replace(/<\/?(?:cite|epigraph|text-author|annotation|date)[^>]*>/gi, '');

    if (!/<p[\s>]/i.test(html)) {
      const plain = html.replace(/<[^>]+>/g, '').trim();
      html = plain ? `<p>${escapeHtml(plain)}</p>` : '<p></p>';
    }

    return { id: `c${index + 1}`, title, html: `<h1>${escapeXml(title)}</h1>\n${html}` };
  }

  private extractBinaries(xml: string): {
    assets: EbookIr['assets'];
    idToHref: Map<string, string>;
  } {
    const assets: EbookIr['assets'] = [];
    const idToHref = new Map<string, string>();
    const re = /<binary\b([^>]*)>([\s\S]*?)<\/binary>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const attrs = m[1];
      const idMatch = /id="([^"]+)"/i.exec(attrs);
      const ctMatch = /content-type="([^"]+)"/i.exec(attrs);
      if (!idMatch) continue;
      const id = idMatch[1];
      const mediaType = ctMatch?.[1] || 'image/jpeg';
      const b64 = m[2].replace(/\s+/g, '');
      try {
        const data = Buffer.from(b64, 'base64');
        const ext =
          mediaType.includes('png') ? 'png' : mediaType.includes('gif') ? 'gif' : 'jpg';
        const href = `images/${id}.${ext}`;
        assets.push({ href, mediaType, data });
        idToHref.set(id, href);
      } catch {
        /* skip bad binary */
      }
    }
    return { assets, idToHref };
  }

  private textOf(xml: string, tag: string): string | null {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = re.exec(xml);
    if (!m) return null;
    return m[1].replace(/<[^>]+>/g, '').trim() || null;
  }
}
