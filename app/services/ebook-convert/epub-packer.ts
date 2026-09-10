import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { EbookIr, escapeXml } from './types';

/**
 * Packs an intermediate representation into a minimal EPUB 2.0 archive
 * compatible with epub.js.
 */
export class EpubPacker {
  public static write(ir: EbookIr, outputPath: string): void {
    if (!ir.chapters.length) {
      throw new Error('EPUB IR sem capítulos');
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    const title = ir.title?.trim() || 'Sem título';
    const author = ir.author?.trim() || 'Desconhecido';
    const language = ir.language?.trim() || 'und';
    const zip = new AdmZip();

    // EPUB requires mimetype as first uncompressed entry
    zip.addFile('mimetype', Buffer.from('application/epub+zip', 'utf-8'));
    const mimeEntry = zip.getEntry('mimetype');
    if (mimeEntry?.header) {
      mimeEntry.header.method = 0; // STORE
    }

    zip.addFile(
      'META-INF/container.xml',
      Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
        'utf-8'
      )
    );

    const manifestItems: string[] = [
      `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
    ];
    const spineItems: string[] = [];
    const ncxNav: string[] = [];

    ir.chapters.forEach((ch, index) => {
      const fileName = `chap_${String(index + 1).padStart(3, '0')}.xhtml`;
      const id = `chap${index + 1}`;
      const xhtml = this.wrapChapter(ch.title, ch.html, language);
      zip.addFile(`OEBPS/${fileName}`, Buffer.from(xhtml, 'utf-8'));
      manifestItems.push(
        `<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`
      );
      spineItems.push(`<itemref idref="${id}"/>`);
      ncxNav.push(
        `<navPoint id="nav${index + 1}" playOrder="${index + 1}">
  <navLabel><text>${escapeXml(ch.title || `Capítulo ${index + 1}`)}</text></navLabel>
  <content src="${fileName}"/>
</navPoint>`
      );
    });

    ir.assets.forEach((asset, index) => {
      const href = asset.href.replace(/^\/+/, '').replace(/\\/g, '/');
      const id = `asset${index + 1}`;
      zip.addFile(`OEBPS/${href}`, asset.data);
      manifestItems.push(
        `<item id="${id}" href="${escapeXml(href)}" media-type="${escapeXml(asset.mediaType)}"/>`
      );
    });

    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(author)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:identifier id="BookId">urn:uuid:${this.simpleId(title + author)}</dc:identifier>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>
`;

    const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${this.simpleId(title + author)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
    ${ncxNav.join('\n    ')}
  </navMap>
</ncx>
`;

    zip.addFile('OEBPS/content.opf', Buffer.from(opf, 'utf-8'));
    zip.addFile('OEBPS/toc.ncx', Buffer.from(ncx, 'utf-8'));
    zip.writeZip(outputPath);
  }

  private static wrapChapter(title: string, html: string, language: string): string {
    const body = html.includes('<body')
      ? html
      : `<body>
<h1>${escapeXml(title || '')}</h1>
${html}
</body>`;

    if (html.trim().startsWith('<?xml') || html.includes('<html')) {
      return html;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}">
<head>
  <title>${escapeXml(title || 'Capítulo')}</title>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
</head>
${body}
</html>
`;
  }

  private static simpleId(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    const hex = h.toString(16).padStart(8, '0');
    return `${hex}${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
  }
}
