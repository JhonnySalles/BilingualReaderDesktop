/**
 * Minimal smoke test for EpubPacker — run after compile:electron:
 *   node dist-electron/app/services/ebook-convert/epub-packer.spec.js
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { EpubPacker } from './epub-packer';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const out = path.join(os.tmpdir(), `br-epub-packer-${Date.now()}.epub`);
EpubPacker.write(
  {
    title: 'Test Book',
    author: 'Author',
    language: 'pt',
    chapters: [
      { id: 'c1', title: 'Capítulo 1', html: '<p>Olá mundo</p>' },
      { id: 'c2', title: 'Capítulo 2', html: '<p>Segundo</p>' }
    ],
    assets: []
  },
  out
);

assert(fs.existsSync(out), 'output missing');
const zip = new AdmZip(out);
const names = zip.getEntries().map(e => e.entryName);
assert(names[0] === 'mimetype' || names.includes('mimetype'), 'mimetype missing');
assert(names.includes('META-INF/container.xml'), 'container missing');
assert(names.includes('OEBPS/content.opf'), 'opf missing');
assert(names.includes('OEBPS/toc.ncx'), 'ncx missing');
assert(names.includes('OEBPS/chap_001.xhtml'), 'chapter1 missing');
assert(names.includes('OEBPS/chap_002.xhtml'), 'chapter2 missing');
const mime = zip.readAsText('mimetype');
assert(mime === 'application/epub+zip', 'bad mimetype');
fs.unlinkSync(out);
console.log('epub-packer.spec OK');
