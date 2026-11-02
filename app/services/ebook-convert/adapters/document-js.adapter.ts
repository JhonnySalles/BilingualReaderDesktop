import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { EbookConverterAdapter, EbookConversionError, EbookIr, escapeHtml } from '../types';
import { EpubPacker } from '../epub-packer';

const EXTS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.xhtml',
  '.docx',
  '.htmlz',
  '.txtz',
  '.pdb',
  '.tcr'
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
      case '.htmlz':
        ir = this.fromHtmlz(inputPath, base);
        break;
      case '.txtz':
        ir = this.fromTxtz(inputPath, base);
        break;
      case '.pdb':
        ir = this.fromPalmDoc(inputPath, base);
        break;
      case '.tcr':
        ir = this.fromTcr(inputPath, base);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mammoth: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mammoth = require('mammoth');
    } catch {
      throw new EbookConversionError(
        'Pacote mammoth não instalado para conversão DOCX nativa',
        'missing_tools'
      );
    }
    const assets: EbookIr['assets'] = [];
    let imgCounter = 0;
    const result = await mammoth.convertToHtml(
      { path: inputPath },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        convertImage: mammoth.images.imgElement((element: any) => {
          return element.read().then((buffer: Buffer) => {
            imgCounter++;
            const ext = element.contentType ? (element.contentType.split('/')[1] || 'png') : 'png';
            const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
            const href = `images/img_${String(imgCounter).padStart(4, '0')}.${safeExt}`;
            assets.push({
              href,
              mediaType: element.contentType || 'image/png',
              data: buffer
            });
            return { src: href };
          });
        })
      }
    );
    const html = this.sanitizeHtml(result.value || '');
    const chapters = this.splitByHeadings(html, title);
    return { title, language: 'und', chapters, assets };
  }

  private fromHtmlz(inputPath: string, fallbackTitle: string): EbookIr {
    const zip = new AdmZip(inputPath);
    const entries = zip.getEntries();
    const htmlEntry = zip.getEntry('index.html');
    if (!htmlEntry) {
      throw new EbookConversionError('HTMLZ inválido: index.html não encontrado', 'conversion_failed');
    }
    const opfEntry = zip.getEntry('metadata.opf');
    let docTitle = fallbackTitle;
    let author: string | undefined;
    let language = 'und';
    if (opfEntry) {
      const opf = opfEntry.getData().toString('utf-8');
      const tm = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
      if (tm?.[1]?.trim()) docTitle = tm[1].trim();
      const am = opf.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (am?.[1]?.trim()) author = am[1].trim();
      const lm = opf.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
      if (lm?.[1]?.trim()) language = lm[1].trim();
    }
    const assets: EbookIr['assets'] = [];
    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName === 'index.html' || entry.entryName === 'metadata.opf') {
        continue;
      }
      const ext = path.extname(entry.entryName).toLowerCase();
      let mediaType = 'application/octet-stream';
      if (/\.(jpe?g)$/i.test(ext)) mediaType = 'image/jpeg';
      else if (ext === '.png') mediaType = 'image/png';
      else if (ext === '.gif') mediaType = 'image/gif';
      else if (ext === '.svg') mediaType = 'image/svg+xml';
      else if (ext === '.webp') mediaType = 'image/webp';
      else if (ext === '.css') mediaType = 'text/css';

      assets.push({
        href: entry.entryName.replace(/\\/g, '/'),
        mediaType,
        data: entry.getData()
      });
    }
    let html = htmlEntry.getData().toString('utf-8');
    html = this.sanitizeHtml(html);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : html;
    const chapters = this.splitByHeadings(body, docTitle);
    return { title: docTitle, author, language, chapters, assets };
  }

  private fromTxtz(inputPath: string, fallbackTitle: string): EbookIr {
    const zip = new AdmZip(inputPath);
    const txtEntry = zip.getEntry('index.txt');
    if (!txtEntry) {
      throw new EbookConversionError('TXTZ inválido: index.txt não encontrado', 'conversion_failed');
    }
    const opfEntry = zip.getEntry('metadata.opf');
    let docTitle = fallbackTitle;
    let author: string | undefined;
    let language = 'und';
    if (opfEntry) {
      const opf = opfEntry.getData().toString('utf-8');
      const tm = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
      if (tm?.[1]?.trim()) docTitle = tm[1].trim();
      const am = opf.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (am?.[1]?.trim()) author = am[1].trim();
      const lm = opf.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
      if (lm?.[1]?.trim()) language = lm[1].trim();
    }
    const assets: EbookIr['assets'] = [];
    const coverEntry = zip
      .getEntries()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((e: any) => !e.isDirectory && /cover\.(jpe?g|png|webp)/i.test(e.entryName));
    if (coverEntry) {
      const ext = path.extname(coverEntry.entryName).toLowerCase();
      const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
      assets.push({
        href: `images/${path.basename(coverEntry.entryName)}`,
        mediaType,
        data: coverEntry.getData()
      });
    }
    const text = txtEntry.getData().toString('utf-8');
    const paragraphs = text
      .split(/\r?\n\r?\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`);

    let coverHtml = '';
    if (assets.length > 0) {
      coverHtml = `<p style="text-align:center;"><img src="${assets[0].href}" alt="Cover"/></p>\n`;
    }
    return {
      title: docTitle,
      author,
      language,
      chapters: [
        {
          id: 'c1',
          title: docTitle,
          html: coverHtml + (paragraphs.join('\n') || `<pre>${escapeHtml(text)}</pre>`)
        }
      ],
      assets
    };
  }

  private fromPalmDoc(inputPath: string, fallbackTitle: string): EbookIr {
    const buf = fs.readFileSync(inputPath);
    if (buf.length < 78) {
      throw new EbookConversionError('PDB inválido: arquivo muito pequeno', 'conversion_failed');
    }
    const numRecords = buf.readUInt16BE(76);
    if (numRecords === 0 || buf.length < 78 + numRecords * 8) {
      throw new EbookConversionError('PDB inválido: tabela de records corrompida', 'conversion_failed');
    }
    const offsets: number[] = [];
    for (let i = 0; i < numRecords; i++) {
      offsets.push(buf.readUInt32BE(78 + i * 8));
    }
    const rec0 = buf.slice(offsets[0], offsets[1] || buf.length);
    const compression = rec0.length >= 2 ? rec0.readUInt16BE(0) : 1;
    const numTextRecs = rec0.length >= 10 ? rec0.readUInt16BE(8) : numRecords - 1;

    const decompressRecord = (input: Buffer): Buffer => {
      const out: number[] = [];
      let i = 0;
      while (i < input.length) {
        const c = input[i++];
        if (c >= 1 && c <= 8) {
          for (let j = 0; j < c && i < input.length; j++) out.push(input[i++]);
        } else if (c <= 0x7f) {
          out.push(c);
        } else if (c >= 0xc0) {
          out.push(32); // space
          out.push(c ^ 0x80);
        } else {
          if (i >= input.length) break;
          const c2 = input[i++];
          const distance = ((c & 0x3f) << 5) | (c2 >> 3);
          const length = (c2 & 0x07) + 3;
          for (let k = 0; k < length; k++) {
            const srcPos = out.length - distance;
            out.push(out[srcPos]);
          }
        }
      }
      return Buffer.from(out);
    };

    const textChunks: Buffer[] = [];
    const maxRec = Math.min(numTextRecs, numRecords - 1);
    for (let r = 1; r <= maxRec; r++) {
      const start = offsets[r];
      const end = r < numRecords - 1 ? offsets[r + 1] : buf.length;
      const chunk = buf.slice(start, end);
      if (compression === 2) {
        textChunks.push(decompressRecord(chunk));
      } else {
        textChunks.push(chunk);
      }
    }
    const rawText = Buffer.concat(textChunks);
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(rawText);
    } catch {
      text = rawText.toString('latin1');
    }

    const paragraphs = text
      .split(/\r?\n\r?\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`);

    return {
      title: fallbackTitle,
      language: 'und',
      chapters: [
        {
          id: 'c1',
          title: fallbackTitle,
          html: paragraphs.join('\n') || `<pre>${escapeHtml(text)}</pre>`
        }
      ],
      assets: []
    };
  }

  private fromTcr(inputPath: string, fallbackTitle: string): EbookIr {
    const buf = fs.readFileSync(inputPath);
    if (buf.length < 10 || buf.slice(0, 9).toString('ascii') !== '!!8-Bit!!') {
      throw new EbookConversionError('TCR inválido: cabeçalho !!8-Bit!! não encontrado', 'conversion_failed');
    }
    let pos = 9;
    const dict: Buffer[] = [];
    for (let i = 0; i < 256; i++) {
      if (pos >= buf.length) break;
      const len = buf[pos++];
      dict.push(buf.slice(pos, pos + len));
      pos += len;
    }
    const out: Buffer[] = [];
    for (; pos < buf.length; pos++) {
      const b = buf[pos];
      if (dict[b]) out.push(dict[b]);
    }
    const raw = Buffer.concat(out);
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    } catch {
      text = raw.toString('latin1');
    }

    const paragraphs = text
      .split(/\r?\n\r?\n+/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br/>')}</p>`);

    return {
      title: fallbackTitle,
      language: 'und',
      chapters: [
        {
          id: 'c1',
          title: fallbackTitle,
          html: paragraphs.join('\n') || `<pre>${escapeHtml(text)}</pre>`
        }
      ],
      assets: []
    };
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
