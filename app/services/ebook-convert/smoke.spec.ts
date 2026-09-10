/**
 * Smoke: DocumentJs TXT + FB2 + factory mode cascade.
 * Run: yarn test:ebook-convert-smoke
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { DocumentJsAdapter } from './adapters/document-js.adapter';
import { Fb2Adapter } from './adapters/fb2.adapter';
import { EbookConvertFactory } from './ebook-convert.factory';
import { EbookConversionError } from './types';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-ebook-smoke-'));

  // TXT via DocumentJs
  const txt = path.join(tmp, 'sample.txt');
  fs.writeFileSync(txt, 'Hello\n\nWorld', 'utf-8');
  const txtOut = path.join(tmp, 'from-txt.epub');
  await new DocumentJsAdapter().convert(txt, txtOut);
  assert(fs.existsSync(txtOut) && fs.statSync(txtOut).size > 0, 'txt epub missing');
  const z1 = new AdmZip(txtOut);
  assert(z1.getEntry('OEBPS/content.opf'), 'txt opf');

  // FB2
  const fb2 = path.join(tmp, 'sample.fb2');
  fs.writeFileSync(
    fb2,
    `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>FB2 Smoke</book-title>
      <author><first-name>A</first-name><last-name>B</last-name></author>
      <lang>pt</lang>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Um</p></title>
      <p>Parágrafo um.</p>
    </section>
  </body>
</FictionBook>`,
    'utf-8'
  );
  const fb2Out = path.join(tmp, 'from-fb2.epub');
  await new Fb2Adapter().convert(fb2, fb2Out);
  assert(fs.existsSync(fb2Out) && fs.statSync(fb2Out).size > 0, 'fb2 epub missing');

  // Factory: passthrough epub
  const factory = new EbookConvertFactory();
  const statuses = factory.getAdapterStatuses();
  assert(statuses.some(s => s.id === 'document-js' && s.available), 'document-js');
  assert(statuses.some(s => s.id === 'fb2' && s.available), 'fb2');
  assert(statuses.some(s => s.id === 'passthrough' && s.available), 'passthrough');

  const epubIn = path.join(tmp, 'native.epub');
  fs.copyFileSync(txtOut, epubIn);
  const epubOut = path.join(tmp, 'copy.epub');
  await factory.convert(epubIn, epubOut, 'auto');
  assert(fs.existsSync(epubOut), 'passthrough copy');

  // Mode ordering: auto prefers calibre before natives when both handle
  const txtEligible = factory
    .getAdapters()
    .filter(a => a.canHandle('.txt') && a.isAvailable());
  const autoOrder = factory.orderCandidates(txtEligible, 'auto').map(a => a.id);
  const nativeOrder = factory.orderCandidates(txtEligible, 'native').map(a => a.id);
  const calibreOrder = factory.orderCandidates(txtEligible, 'calibre').map(a => a.id);
  if (autoOrder.includes('calibre')) {
    assert(autoOrder.indexOf('calibre') < autoOrder.indexOf('document-js'), 'auto: calibre before document-js');
  }
  assert(!nativeOrder.includes('calibre'), 'native mode excludes calibre');
  assert(!nativeOrder.includes('pandoc'), 'native mode excludes pandoc');
  assert(!calibreOrder.includes('document-js'), 'calibre mode excludes document-js');

  // native mode: TXT still works via DocumentJs
  const nativeTxtOut = path.join(tmp, 'native-mode-txt.epub');
  await factory.convert(txt, nativeTxtOut, 'native');
  assert(fs.existsSync(nativeTxtOut) && fs.statSync(nativeTxtOut).size > 0, 'native txt');

  // native mode: PDF must fail (no Calibre in cascade)
  const pdf = path.join(tmp, 'x.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4 fake');
  const pdfOut = path.join(tmp, 'x.epub');
  let nativePdfErr: Error | null = null;
  try {
    await factory.convert(pdf, pdfOut, 'native');
  } catch (e) {
    nativePdfErr = e as Error;
  }
  assert(nativePdfErr, 'native mode pdf should fail');
  const nativeMsg = nativePdfErr!.message;
  assert(
    nativePdfErr instanceof EbookConversionError || /não é suportado|unsupported/i.test(nativeMsg),
    'native pdf error shape'
  );

  // calibre mode without tool — if calibre missing, expect missing_tools
  if (!statuses.find(s => s.id === 'calibre')?.available) {
    let calibreErr: Error | null = null;
    try {
      await factory.convert(pdf, path.join(tmp, 'calibre-missing.epub'), 'calibre');
    } catch (e) {
      calibreErr = e as Error;
    }
    assert(calibreErr, 'calibre mode without tool should fail');
  }

  console.log('ebook-convert smoke OK');
  console.log(
    'adapters:',
    statuses.map(s => `${s.id}:${s.available ? 'yes' : 'no'}`).join(', ')
  );
  console.log('auto order (.txt):', autoOrder.join(' > '));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
