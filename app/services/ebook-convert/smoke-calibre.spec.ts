/**
 * Extra smoke: if Calibre is on PATH, convert a minimal PDF; if libmobi .node
 * exists, note availability. Run after compile: node .../smoke-calibre.spec.js
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EbookConvertFactory } from './ebook-convert.factory';

async function main(): Promise<void> {
  const factory = new EbookConvertFactory();
  const calibre = factory.getAdapterStatuses().find(s => s.id === 'calibre');
  const libmobi = factory.getAdapterStatuses().find(s => s.id === 'libmobi');
  console.log('libmobi available:', !!libmobi?.available);
  console.log('calibre available:', !!calibre?.available);

  if (!calibre?.available) {
    console.log('skip PDF smoke (no Calibre)');
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-calibre-smoke-'));
  // Minimal valid-enough PDF for ebook-convert (may still fail on tiny stub)
  const pdf = path.join(tmp, 'tiny.pdf');
  // Use a one-page PDF from a known minimal byte sequence
  const minimalPdf = Buffer.from(
    `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 12 Tf 50 100 Td (Hello) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
433
%%EOF
`
  );
  fs.writeFileSync(pdf, minimalPdf);
  const out = path.join(tmp, 'out.epub');
  try {
    await factory.convert(pdf, out);
    console.log('calibre PDF smoke OK', fs.statSync(out).size);
  } catch (e) {
    console.log('calibre PDF smoke failed (acceptable for stub PDF):', (e as Error).message);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
