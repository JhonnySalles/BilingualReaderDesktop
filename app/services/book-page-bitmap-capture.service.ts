/**
 * Hidden Electron window that renders EPUB pages (epub.js) and returns PNG data URLs.
 * Never touches the visible reader window.
 */
import { app, BrowserWindow, WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface BookCapturePageRequest {
  index: number;
  cfi: string;
}

export interface BookCaptureTheme {
  background: string;
  color: string;
  fontFamily: string;
  fontSizePx: number;
  lineHeight: number;
  textAlign: string;
  paddingPx: number;
  writingMode?: 'horizontal-tb' | 'vertical-rl';
  direction?: 'ltr' | 'rtl';
  spread?: 'none' | 'auto';
}

export interface BookCaptureSpreadRequest {
  bookUrl: string;
  width: number;
  height: number;
  theme: BookCaptureTheme;
  pages: BookCapturePageRequest[];
}

export interface BookCaptureSpreadResult {
  [index: string]: Buffer | string; // PNG Buffer (or data URL string) keyed by location index
}

function resolveEpubJsPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules/epubjs/dist/epub.min.js'),
    path.join(__dirname, '../../node_modules/epubjs/dist/epub.min.js'),
    path.join(process.cwd(), 'node_modules/epubjs/dist/epub.min.js')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('[book-capture] epub.min.js not found');
}

function resolveJsZipPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules/jszip/dist/jszip.min.js'),
    path.join(app.getAppPath(), 'node_modules/epubjs/node_modules/jszip/dist/jszip.min.js'),
    path.join(__dirname, '../../node_modules/jszip/dist/jszip.min.js'),
    path.join(process.cwd(), 'node_modules/jszip/dist/jszip.min.js')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('[book-capture] jszip.min.js not found');
}

const CAPTURE_BOOTSTRAP = `
(function () {
  var book = null;
  var rendition = null;
  var readyToken = 0;

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(function () { r(); }); });
  }

  async function doubleRaf() {
    await nextFrame();
    await nextFrame();
  }

  function applyTheme(theme) {
    if (!rendition || !theme) return;
    var bg = (theme.background || '#0f172a') + ' !important';
    var tate = theme.writingMode === 'vertical-rl';
    var htmlExtra = tate
      ? { 'writing-mode': 'vertical-rl', '-webkit-writing-mode': 'vertical-rl', 'text-orientation': 'mixed', height: '100%', 'max-height': '100%', overflow: 'hidden' }
      : { 'writing-mode': 'horizontal-tb', '-webkit-writing-mode': 'horizontal-tb', 'text-orientation': 'mixed' };
    var bodyExtra = tate
      ? { 'writing-mode': 'vertical-rl', '-webkit-writing-mode': 'vertical-rl', 'text-orientation': 'mixed', height: '100%', 'max-height': '100%', 'overflow-y': 'hidden', 'overflow-x': 'auto' }
      : { 'writing-mode': 'horizontal-tb', '-webkit-writing-mode': 'horizontal-tb' };
    var imgRules = (theme && theme.imgRules) || (tate
      ? {
          'max-width': '100% !important',
          'max-height': '100% !important',
          'width': 'auto !important',
          'height': 'auto !important',
          'display': 'block !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'object-fit': 'contain'
        }
      : {
          'max-width': '100% !important',
          'width': 'auto !important',
          'height': 'auto !important',
          'display': 'block !important',
          'margin-left': 'auto !important',
          'margin-right': 'auto !important',
          'object-fit': 'contain'
        });
    var figureRules = (theme && theme.figureRules) || {
      'max-width': '100% !important',
      'margin-left': 'auto !important',
      'margin-right': 'auto !important',
      'margin-top': '0.5em !important',
      'margin-bottom': '0.5em !important',
      'display': 'block !important'
    };
    if (tate && !figureRules['max-height']) figureRules['max-height'] = '100% !important';
    rendition.themes.default({
      html: Object.assign({ background: bg }, htmlExtra),
      body: Object.assign({
        'font-family': (theme.fontFamily || 'sans-serif') + ' !important',
        'font-size': (theme.fontSizePx || 16) + 'px !important',
        'line-height': (theme.lineHeight || 1.5) + ' !important',
        'text-align': (theme.textAlign || 'left') + ' !important',
        'padding': (theme.paddingPx || 16) + 'px !important',
        background: bg,
        color: (theme.color || '#e2e8f0') + ' !important'
      }, bodyExtra),
      p: {
        'text-align': (theme.textAlign || 'left') + ' !important',
        'line-height': (theme.lineHeight || 1.5) + ' !important'
      },
      a: { color: '#a5b4fc !important' },
      ruby: {
        'ruby-position': 'over',
        'ruby-align': 'center'
      },
      rt: tate
        ? {
            'font-size': '0.6em',
            'line-height': '1',
            'text-orientation': 'upright',
            '-webkit-text-orientation': 'upright',
            color: '#cbd5e1'
          }
        : {
            'font-size': '0.75em',
            'line-height': '1.1',
            color: '#cbd5e1'
          },
      'img, svg, image, video': imgRules,
      figure: figureRules,
      'p img, div img, figure img': imgRules
    });
  }

  function sizeContentImages(doc) {
    if (!doc) return;
    var imgs = Array.prototype.slice.call(doc.querySelectorAll('img'));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.naturalWidth > 1 && img.naturalHeight > 1) {
        if (!img.getAttribute('width')) img.setAttribute('width', String(img.naturalWidth));
        if (!img.getAttribute('height')) img.setAttribute('height', String(img.naturalHeight));
        img.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      }
    }
  }

  async function waitForImages(timeoutMs) {
    var iframe = document.querySelector('#viewer iframe');
    var doc = iframe && iframe.contentDocument;
    if (!doc) return;
    sizeContentImages(doc);
    var imgs = Array.prototype.slice.call(doc.querySelectorAll('img'));
    if (!imgs.length) return;
    var pending = imgs.map(function (img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(function (resolve) {
        var done = function () {
          sizeContentImages(doc);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        if (typeof img.decode === 'function') {
          img.decode().then(done, done);
        }
      });
    });
    await Promise.race([Promise.all(pending), sleep(timeoutMs)]);
    sizeContentImages(doc);
  }

  window.__BR_CAPTURE = {
    ready: function () {
      return typeof ePub === 'function';
    },
    open: async function (bookUrl, opts) {
      readyToken++;
      var token = readyToken;
      if (rendition) {
        try { rendition.destroy(); } catch (e) {}
        rendition = null;
      }
      if (book) {
        try { book.destroy(); } catch (e) {}
        book = null;
      }
      var el = document.getElementById('viewer');
      el.innerHTML = '';
      if (typeof ePub !== 'function') {
        throw new Error('ePub not loaded (typeof ePub=' + (typeof ePub) + ', JSZip=' + (typeof JSZip) + ')');
      }
      book = ePub(bookUrl);
      await book.ready;
      if (token !== readyToken) return false;
      var flowOpts = {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        allowScriptedContent: false,
        defaultDirection: (opts && opts.direction) || 'ltr',
        spread: (opts && opts.spread) || 'none'
      };
      rendition = book.renderTo(el, flowOpts);
      rendition.hooks.content.register(function (contents) {
        if (contents && contents.document) {
          sizeContentImages(contents.document);
        }
      });
      applyTheme(opts && opts.theme);
      await doubleRaf();
      return true;
    },
    display: async function (cfi, theme) {
      if (!rendition) throw new Error('rendition not ready');
      applyTheme(theme);
      await rendition.display(cfi);
      for (var i = 0; i < 20; i++) {
        var iframe = document.querySelector('#viewer iframe');
        if (iframe && iframe.clientWidth > 0 && iframe.clientHeight > 0) break;
        await doubleRaf();
      }
      await waitForImages(2000);
      await doubleRaf();
      return true;
    },
    destroy: function () {
      readyToken++;
      if (rendition) {
        try { rendition.destroy(); } catch (e) {}
        rendition = null;
      }
      if (book) {
        try { book.destroy(); } catch (e) {}
        book = null;
      }
    }
  };
})();
`;

/** Inline vendor + bootstrap. Also inject bootstrap after load as a safety net. */
function buildCaptureHtml(jsZipSrc: string, epubSrc: string): string {
  // Guard against accidental </script> sequences breaking the HTML parser.
  const safeZip = jsZipSrc.replace(/<\/(script)/gi, '<\\/$1');
  const safeEpub = epubSrc.replace(/<\/(script)/gi, '<\\/$1');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
    #viewer { position: absolute; inset: 0; width: 100%; height: 100%; background: #0f172a; }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <script>${safeZip}</script>
  <script>${safeEpub}</script>
  <script>${CAPTURE_BOOTSTRAP}</script>
</body>
</html>`;
}

async function runInPage<T>(wc: WebContents, expression: string): Promise<T> {
  const wrapped =
    `(async () => { try { return { ok: true, value: await (${expression}) }; }` +
    ` catch (e) { return { ok: false, error: String(e && e.message ? e.message : e), stack: String(e && e.stack ? e.stack : '') }; } })()`;
  const result = (await wc.executeJavaScript(wrapped, true)) as {
    ok: boolean;
    value?: T;
    error?: string;
    stack?: string;
  };
  if (!result || !result.ok) {
    throw new Error(result?.error || 'unknown renderer error');
  }
  return result.value as T;
}

export class BookPageBitmapCaptureService {
  private static _instance: BookPageBitmapCaptureService | null = null;
  static get instance(): BookPageBitmapCaptureService {
    if (!this._instance) this._instance = new BookPageBitmapCaptureService();
    return this._instance;
  }

  private win: BrowserWindow | null = null;
  private htmlPath: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private loadedBookUrl: string | null = null;
  private loadedSize: { w: number; h: number } | null = null;

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async captureSpread(req: BookCaptureSpreadRequest): Promise<BookCaptureSpreadResult> {
    return this.enqueue(() => this.captureSpreadLocked(req));
  }

  destroy(): void {
    this.loadedBookUrl = null;
    this.loadedSize = null;
    this.destroyWindowOnly();
    if (this.htmlPath) {
      try {
        fs.unlinkSync(this.htmlPath);
      } catch {
        /* ignore */
      }
      this.htmlPath = null;
    }
  }

  private destroyWindowOnly(): void {
    if (this.win && !this.win.isDestroyed()) {
      try {
        void this.win.webContents.executeJavaScript(
          'window.__BR_CAPTURE && window.__BR_CAPTURE.destroy && window.__BR_CAPTURE.destroy()'
        );
      } catch {
        /* ignore */
      }
      try {
        this.win.destroy();
      } catch {
        /* ignore */
      }
    }
    this.win = null;
    this.loadedBookUrl = null;
    this.loadedSize = null;
  }

  private ensureHtmlFile(): string {
    const jsZipSrc = fs.readFileSync(resolveJsZipPath(), 'utf8');
    const epubSrc = fs.readFileSync(resolveEpubJsPath(), 'utf8');
    const html = buildCaptureHtml(jsZipSrc, epubSrc);
    const dir = path.join(os.tmpdir(), 'br-book-capture');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'capture-host.html');
    fs.writeFileSync(filePath, html, 'utf8');
    this.htmlPath = filePath;
    return filePath;
  }

  private async isCaptureReady(wc: WebContents): Promise<boolean> {
    try {
      return !!(await wc.executeJavaScript(
        '!!(window.__BR_CAPTURE && typeof window.__BR_CAPTURE.open === "function" && window.__BR_CAPTURE.ready && window.__BR_CAPTURE.ready())'
      ));
    } catch {
      return false;
    }
  }

  private async ensureWindow(width: number, height: number): Promise<BrowserWindow> {
    const w = Math.max(64, Math.floor(width));
    const h = Math.max(64, Math.floor(height));

    if (this.win && !this.win.isDestroyed()) {
      const ready = await this.isCaptureReady(this.win.webContents);
      if (ready) {
        const [cw, ch] = this.win.getSize();
        if (cw !== w || ch !== h) {
          this.win.setSize(w, h);
          this.loadedSize = null;
        }
        return this.win;
      }
      // Stale / failed bootstrap — recreate
      this.destroyWindowOnly();
    }

    const htmlPath = this.ensureHtmlFile();

    this.win = new BrowserWindow({
      show: false,
      width: w,
      height: h,
      useContentSize: true,
      frame: false,
      transparent: false,
      backgroundColor: '#0f172a',
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false,
        webSecurity: false
      }
    });

    this.win.webContents.setFrameRate(60);

    let loadFailed: Error | null = null;
    this.win.webContents.once('did-fail-load', (_e, code, desc, url) => {
      loadFailed = new Error(`[book-capture] did-fail-load ${code} ${desc} ${url}`);
    });

    await this.win.loadFile(htmlPath);
    if (loadFailed) {
      this.destroyWindowOnly();
      throw loadFailed;
    }

    // Safety net: if the inline bootstrap failed to parse, inject it now.
    if (!(await this.isCaptureReady(this.win.webContents))) {
      try {
        await this.win.webContents.executeJavaScript(CAPTURE_BOOTSTRAP, true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.destroyWindowOnly();
        throw new Error(`[book-capture] bootstrap inject failed: ${msg}`);
      }
    }

    for (let i = 0; i < 100; i++) {
      if (await this.isCaptureReady(this.win.webContents)) {
        this.loadedBookUrl = null;
        this.loadedSize = { w, h };
        return this.win;
      }
      await new Promise(r => setTimeout(r, 30));
    }

    const diag = await this.win.webContents
      .executeJavaScript(
        'JSON.stringify({ hasCapture: !!window.__BR_CAPTURE, ePub: typeof ePub, JSZip: typeof JSZip })'
      )
      .catch(() => '{"diag":"unavailable"}');
    this.destroyWindowOnly();
    throw new Error(`[book-capture] host not ready after load: ${diag}`);
  }

  private async captureSpreadLocked(
    req: BookCaptureSpreadRequest,
    retried = false
  ): Promise<BookCaptureSpreadResult> {
    const width = Math.max(64, Math.floor(req.width));
    const height = Math.max(64, Math.floor(req.height));
    let win = await this.ensureWindow(width, height);
    let wc = win.webContents;

    if (!(await this.isCaptureReady(wc))) {
      this.destroyWindowOnly();
      if (retried) {
        throw new Error('[book-capture] __BR_CAPTURE.open unavailable');
      }
      win = await this.ensureWindow(width, height);
      wc = win.webContents;
      if (!(await this.isCaptureReady(wc))) {
        throw new Error('[book-capture] __BR_CAPTURE.open unavailable after recreate');
      }
    }

    const needOpen =
      this.loadedBookUrl !== req.bookUrl ||
      !this.loadedSize ||
      this.loadedSize.w !== width ||
      this.loadedSize.h !== height;

    if (needOpen) {
      const openArgs = {
        direction: req.theme?.direction || 'ltr',
        spread: req.theme?.spread || 'none',
        theme: req.theme
      };
      const openOk = await runInPage<boolean>(
        wc,
        `window.__BR_CAPTURE.open(${JSON.stringify(req.bookUrl)}, ${JSON.stringify(openArgs)})`
      );
      if (!openOk) {
        throw new Error('[book-capture] failed to open book');
      }
      this.loadedBookUrl = req.bookUrl;
      this.loadedSize = { w: width, h: height };
    }

    const out: BookCaptureSpreadResult = {};
    for (const page of req.pages) {
      if (!page?.cfi) continue;
      await runInPage<boolean>(
        wc,
        `window.__BR_CAPTURE.display(${JSON.stringify(page.cfi)}, ${JSON.stringify(req.theme)})`
      );
      // Images already waited in-page; keep a short paint settle for GPU flush.
      await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
          try {
            wc.removeListener('paint', onPaint);
          } catch {
            /* ignore */
          }
          resolve();
        }, 120);
        const onPaint = () => {
          clearTimeout(timeout);
          try {
            wc.removeListener('paint', onPaint);
          } catch {
            /* ignore */
          }
          setTimeout(() => resolve(), 8);
        };
        wc.on('paint', onPaint);
      });
      const image = await wc.capturePage({
        x: 0,
        y: 0,
        width,
        height
      });
      if (!image.isEmpty()) {
        out[String(page.index)] = image.toPNG();
      }
    }
    return out;
  }
}
