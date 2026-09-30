import AdmZip from 'adm-zip';
import * as fs from 'fs';
import { EpubBookExtractor } from '../../../../app/parser/book/epub-book-extractor';

jest.mock('adm-zip');
jest.mock('fs');

describe('EpubBookExtractor', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let mockZipInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockZipInstance = {
      getEntry: jest.fn(),
      getEntries: jest.fn().mockReturnValue([]),
      readAsText: jest.fn(),
      readFile: jest.fn(),
    };

    (AdmZip as unknown as jest.Mock).mockImplementation(() => mockZipInstance);
    mockFs.existsSync.mockReturnValue(true);
  });

  describe('extractMetadata', () => {
    it('should extract basic metadata correctly from container.xml and .opf file', () => {
      const containerXml = `
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `;

      const opfXml = `
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Test Light Novel</dc:title>
            <dc:creator>Test Author</dc:creator>
            <dc:publisher>Test Publisher</dc:publisher>
            <dc:language>ja</dc:language>
            <dc:description><p>This is a <b>cool</b> description &amp; story.</p></dc:description>
            <dc:identifier scheme="ISBN">978-1234567890</dc:identifier>
            <meta name="calibre:series" content="Great Adventure Series"/>
            <dc:subject>Fantasy</dc:subject>
            <dc:subject>Adventure</dc:subject>
            <meta name="cover" content="cover-img"/>
          </metadata>
          <manifest>
            <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
          </manifest>
        </package>
      `;

      const mockBuffer = Buffer.from([0xff, 0xd8, 0xff]);

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return { entryName };
        if (entryName === 'OEBPS/content.opf') return { entryName };
        if (entryName === 'OEBPS/images/cover.jpg') return { entryName };
        return null;
      });

      mockZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry.entryName === 'META-INF/container.xml') return containerXml;
        if (entry.entryName === 'OEBPS/content.opf') return opfXml;
        return '';
      });

      mockZipInstance.readFile.mockReturnValue(mockBuffer);

      const metadata = EpubBookExtractor.extractMetadata('/fake/path/book.epub');

      expect(metadata.title).toBe('Test Light Novel');
      expect(metadata.author).toBe('Test Author');
      expect(metadata.publisher).toBe('Test Publisher');
      expect(metadata.language).toBe('ja');
      expect(metadata.annotation).toBe('This is a cool description & story.');
      expect(metadata.isbn).toBe('978-1234567890');
      expect(metadata.series).toBe('Great Adventure Series');
      expect(metadata.genre).toBe('Fantasy');
      expect(metadata.tags).toBe('Fantasy, Adventure');
      expect(metadata.coverImage).toEqual(mockBuffer);
    });

    it('should fallback to finding .opf entry if container.xml is missing', () => {
      const opfXml = `
        <package>
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>Fallback Book Title</dc:title>
            <meta property="belongs-to-collection">Collection Series</meta>
            <dc:identifier>urn:isbn:9780987654321</dc:identifier>
          </metadata>
        </package>
      `;

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'book.opf') return { entryName: 'book.opf' };
        return null;
      });

      mockZipInstance.getEntries.mockReturnValue([
        { entryName: 'book.opf', isDirectory: false },
        { entryName: 'cover.png', isDirectory: false }
      ]);

      mockZipInstance.readAsText.mockReturnValue(opfXml);
      mockZipInstance.readFile.mockReturnValue(Buffer.from('cover-data'));

      const metadata = EpubBookExtractor.extractMetadata('/fake/path/book.epub');

      expect(metadata.title).toBe('Fallback Book Title');
      expect(metadata.series).toBe('Collection Series');
      expect(metadata.isbn).toBe('9780987654321');
      expect(metadata.coverImage).toEqual(Buffer.from('cover-data'));
    });

    it('should handle cover image resolution by properties="cover-image" and fallback by filename', () => {
      const opfXml = `
        <package>
          <metadata>
            <dc:title>EPUB3 Cover Test</dc:title>
          </metadata>
          <manifest>
            <item id="c1" href="covers/main.jpg" properties="cover-image" media-type="image/jpeg"/>
          </manifest>
        </package>
      `;

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return null;
        if (entryName === 'content.opf') return { entryName };
        if (entryName === 'covers/main.jpg') return { entryName };
        return null;
      });

      mockZipInstance.getEntries.mockReturnValue([
        { entryName: 'content.opf', isDirectory: false },
        { entryName: 'covers/main.jpg', isDirectory: false }
      ]);

      mockZipInstance.readAsText.mockReturnValue(opfXml);
      const coverBuffer = Buffer.from('image-bytes');
      mockZipInstance.readFile.mockReturnValue(coverBuffer);

      const metadata = EpubBookExtractor.extractMetadata('/fake/path/book.epub');
      expect(metadata.title).toBe('EPUB3 Cover Test');
      expect(metadata.coverImage).toEqual(coverBuffer);
    });

    it('should gracefully handle corrupt zip or errors', () => {
      (AdmZip as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Corrupt zip');
      });

      const metadata = EpubBookExtractor.extractMetadata('/fake/path/corrupt.epub');

      expect(metadata.title).toBe('');
      expect(metadata.author).toBe('');
      expect(metadata.coverImage).toBeNull();
    });
  });

  describe('countWords', () => {
    it('should return 0 if file does not exist or is empty', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(EpubBookExtractor.countWords('/invalid/path.epub')).toBe(0);
      expect(EpubBookExtractor.countWords('')).toBe(0);
    });

    it('should count western words correctly from spine items', () => {
      const containerXml = `<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>`;
      const opfXml = `
        <package>
          <manifest>
            <item id="ch1" href="chapter1.html"/>
            <item id="ch2" href="chapter2.html"/>
          </manifest>
          <spine>
            <itemref idref="ch1"/>
            <itemref idref="ch2"/>
          </spine>
        </package>
      `;

      const ch1Content = '<html><body><h1>Chapter One</h1><p>Hello world from unit test.</p></body></html>';
      const ch2Content = '<html><body><script>const bad = "ignore";</script><style>.test{}</style><p>Second page with more text.</p></body></html>';

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return { entryName };
        if (entryName === 'package.opf') return { entryName };
        if (entryName === 'chapter1.html') return { entryName };
        if (entryName === 'chapter2.html') return { entryName };
        return null;
      });

      mockZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry.entryName === 'META-INF/container.xml') return containerXml;
        if (entry.entryName === 'package.opf') return opfXml;
        if (entry.entryName === 'chapter1.html') return ch1Content;
        if (entry.entryName === 'chapter2.html') return ch2Content;
        return '';
      });

      const totalWords = EpubBookExtractor.countWords('/fake/book.epub');
      // ch1: "Chapter One Hello world from unit test." = 7 words
      // ch2: "Second page with more text." = 5 words
      expect(totalWords).toBe(12);
    });

    it('should count CJK characters correctly and strip furigana <rt> tags', () => {
      const containerXml = `<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>`;
      const opfXml = `
        <package>
          <manifest><item id="jp1" href="jp1.xhtml"/></manifest>
          <spine><itemref idref="jp1"/></spine>
        </package>
      `;

      // CJK text with ruby/rt furigana: 日(1) 本(2) 語(3) の(4) 本(5) を(6) 読(7) み(8) ま(9) す(10)
      const jpContent = `
        <html xmlns="http://www.w3.org/1999/xhtml">
          <body>
            <p><ruby>日本語<rt>にほんご</rt></ruby>の<ruby>本<rt>ほん</rt></ruby>を読みます。</p>
          </body>
        </html>
      `;

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return { entryName };
        if (entryName === 'package.opf') return { entryName };
        if (entryName === 'jp1.xhtml') return { entryName };
        return null;
      });

      mockZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry.entryName === 'META-INF/container.xml') return containerXml;
        if (entry.entryName === 'package.opf') return opfXml;
        if (entry.entryName === 'jp1.xhtml') return jpContent;
        return '';
      });

      const totalWords = EpubBookExtractor.countWords('/fake/jp.epub');
      // 日本語の本を読みます。 -> 10 CJK characters: 日, 本, 語, の, 本, を, 読, み, ま, す
      expect(totalWords).toBe(10);
    });

    it('should respect pageStart and pageEnd parameters', () => {
      const opfXml = `
        <package>
          <manifest>
            <item id="c1" href="c1.html"/>
            <item id="c2" href="c2.html"/>
            <item id="c3" href="c3.html"/>
          </manifest>
          <spine>
            <itemref idref="c1"/>
            <itemref idref="c2"/>
            <itemref idref="c3"/>
          </spine>
        </package>
      `;

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return null;
        if (entryName === 'c.opf') return { entryName };
        if (entryName === 'c1.html') return { entryName };
        if (entryName === 'c2.html') return { entryName };
        if (entryName === 'c3.html') return { entryName };
        return null;
      });

      mockZipInstance.getEntries.mockReturnValue([{ entryName: 'c.opf', isDirectory: false }]);

      mockZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry.entryName === 'c.opf') return opfXml;
        if (entry.entryName === 'c1.html') return '<p>One two three</p>'; // 3 words
        if (entry.entryName === 'c2.html') return '<p>Four five</p>';      // 2 words
        if (entry.entryName === 'c3.html') return '<p>Six seven eight</p>';// 3 words
        return '';
      });

      const count = EpubBookExtractor.countWords('/fake/book.epub', 2, 2); // only c2
      expect(count).toBe(2);
    });
  });

  describe('calculatePages', () => {
    it('should return 0 if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(EpubBookExtractor.calculatePages('/nonexistent.epub')).toBe(0);
    });

    it('should count spine items correctly from opf', () => {
      const containerXml = `<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>`;
      const opfXml = `
        <package>
          <spine>
            <itemref idref="p1"/>
            <itemref idref="p2"/>
            <itemref idref="p3"/>
            <itemref idref="p4"/>
          </spine>
        </package>
      `;

      mockZipInstance.getEntry.mockImplementation((entryName: string) => {
        if (entryName === 'META-INF/container.xml') return { entryName };
        if (entryName === 'content.opf') return { entryName };
        return null;
      });

      mockZipInstance.readAsText.mockImplementation((entry: any) => {
        if (entry.entryName === 'META-INF/container.xml') return containerXml;
        if (entry.entryName === 'content.opf') return opfXml;
        return '';
      });

      expect(EpubBookExtractor.calculatePages('/fake/book.epub')).toBe(4);
    });

    it('should fallback to counting html/xhtml entries in zip if opf spine is empty or missing', () => {
      mockZipInstance.getEntry.mockReturnValue(null);
      mockZipInstance.getEntries.mockReturnValue([
        { entryName: 'text/ch1.xhtml', isDirectory: false },
        { entryName: 'text/ch2.html', isDirectory: false },
        { entryName: 'style.css', isDirectory: false }
      ]);

      expect(EpubBookExtractor.calculatePages('/fake/book.epub')).toBe(2);
    });
  });
});
