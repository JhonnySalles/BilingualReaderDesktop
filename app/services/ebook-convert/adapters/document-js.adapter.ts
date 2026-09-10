import * as fs from 'fs';
import * as path from 'path';
import { EbookConverterAdapter, EbookConversionError, EbookIr, escapeHtml } from '../types';
import { EpubPacker } from '../epub-packer';

const EXTS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.xhtml',
  '.docx'
]);

export class DocumentJsAdapter implements EbookConverterAdapter {
  readonly id = 'document-js' as const;
  readonly label = 'Documentos (JS)';
  readonly priority = 80;

  isAvailable(): boolean {
    return true;
  }

  canHandle(ext: string): boolean {
    return EXTS.has(ext.toLowerCase());
  }

  async convert(inputPath: string, outputEpubPath: string): Promise<void> {
    const ext = path.extname(inputPath).toLowerCase();
    const base = path.basename(inputPath, ext);
    let ir: EbookIr;

    switch (ext) {
      case '.txt':
        ir = this.fromTxt(inputPath, base);
        break;
      case '.md':
      case '.markdown':
        ir = this.fromMarkdown(inputPath, base);
        break;
      case '.html':
      case '.htm':
      case '.xhtml':
        ir = this.fromHtml(inputPath, base);
        break;
      case '.docx':
        ir = await this.fromDocx(inputPath, base);
        break;
      default:
        throw new EbookConversionError(`Formato ${ext} não suportado pelo DocumentJs`, 'unsupported');
    }

    EpubPacker.write(ir, outputEpubPath);
  }

  private fromTxt(inputPath: string, title: string): EbookIr {
    const text = fs.readFileSync(inputPath, 'utf-8');
    const paragraphs = text
      .split(/\r?\n\r?\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`);
    return {
      title,
      language: 'und',
      chapters: [
        {
          id: 'c1',
          title,
          html: paragraphs.join('\n') || `<pre>${escapeHtml(text)}</pre>`
        }
      ],
      assets: []
    };
  }

  private fromMarkdown(inputPath: string, title: string): EbookIr {
    const md = fs.readFileSync(inputPath, 'utf-8');
    const html = this.markdownToHtml(md);
    const chapters = this.splitByHeadings(html, title);
    return { title, language: 'und', chapters, assets: [] };
  }

  private fromHtml(inputPath: string, title: string): EbookIr {
    let html = fs.readFileSync(inputPath, 'utf-8');
    html = this.sanitizeHtml(html);
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const docTitle = titleMatch?.[1]?.trim() || title;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : html;
    return {
      title: docTitle,
      language: 'und',
      chapters: [{ id: 'c1', title: docTitle, html: body }],
      assets: []
    };
  }

  private async fromDocx(inputPath: string, title: string): Promise<EbookIr> {
    let mammoth: { convertToHtml: (input: { path: string }) => Promise<{ value: string }> };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mammoth = require('mammoth');
    } catch {
      throw new EbookConversionError(
        'Pacote mammoth não instalado para conversão DOCX nativa',
        'missing_tools'
      );
    }
    const result = await mammoth.convertToHtml({ path: inputPath });
    const html = this.sanitizeHtml(result.value || '');
    const chapters = this.splitByHeadings(html, title);
    return { title, language: 'und', chapters, assets: [] };
  }

  /** Minimal markdown → HTML (headings, lists, emphasis, paragraphs). */
  private markdownToHtml(md: string): string {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let inList = false;
    let para: string[] = [];

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${para.join(' ')}</p>`);
        para = [];
      }
    };
    const flushList = () => {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        flushPara();
        flushList();
        continue;
      }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        flushPara();
        flushList();
        const level = heading[1].length;
        out.push(`<h${level}>${this.inlineMd(heading[2])}</h${level}>`);
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        flushPara();
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${this.inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`);
        continue;
      }
      flushList();
      para.push(this.inlineMd(line.trim()));
    }
    flushPara();
    flushList();
    return out.join('\n');
  }

  private inlineMd(text: string): string {
    let t = escapeHtml(text);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return t;
  }

  private splitByHeadings(html: string, fallbackTitle: string): EbookIr['chapters'] {
    const parts = html.split(/(?=<h[1-2]\b)/i).filter(p => p.trim());
    if (parts.length <= 1) {
      return [{ id: 'c1', title: fallbackTitle, html: html || '<p></p>' }];
    }
    return parts.map((chunk, i) => {
      const titleMatch = chunk.match(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i);
      const title =
        titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || `Capítulo ${i + 1}`;
      return { id: `c${i + 1}`, title, html: chunk };
    });
  }

  private sanitizeHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }
}
