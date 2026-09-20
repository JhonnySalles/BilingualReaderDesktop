import type { BookCurlBitmaps } from './book-curl.capture';
import {
  cancelBookCurlTurns,
  paintBookCurlProgress,
  playBookCurlTurn
} from './book-curl.player';

function makeEl(w = 200, h = 300): HTMLElement {
  const el = document.createElement('div');
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.position = 'relative';
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true });
  document.body.appendChild(el);
  return el;
}

function makeSource(w: number, h: number, fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return c;
}

async function fakeBitmaps(): Promise<BookCurlBitmaps> {
  const front = makeSource(100, 150, '#f00');
  const under = makeSource(100, 150, '#0f0');
  const frontBmp = await createImageBitmap(front);
  const underBmp = await createImageBitmap(under);
  return {
    front: frontBmp,
    under: underBmp,
    width: 100,
    height: 150,
    surfaceColor: '#0f172a'
  };
}

describe('playBookCurlTurn', () => {
  afterEach(() => {
    cancelBookCurlTurns();
    for (const el of Array.from(document.body.children)) {
      if (el instanceof HTMLElement && el.dataset['ptTest'] === '1') {
        el.remove();
      }
    }
  });

  function hostTrio(): {
    host: HTMLElement;
    viewer: HTMLElement;
    peek: HTMLElement;
  } {
    const host = makeEl();
    host.dataset['ptTest'] = '1';
    const viewer = makeEl();
    viewer.dataset['ptTest'] = '1';
    const peek = makeEl();
    peek.dataset['ptTest'] = '1';
    host.appendChild(viewer);
    host.appendChild(peek);
    return { host, viewer, peek };
  }

  it('next (dir=1) folds front; under is base only in 2d', async () => {
    const { host, viewer, peek } = hostTrio();
    const bitmaps = await fakeBitmaps();
    const sources: unknown[] = [];
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    spyOn(CanvasRenderingContext2D.prototype, 'drawImage').and.callFake(
      function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        sources.push(args[0]);
        return (orig as (...a: unknown[]) => void).apply(this, args);
      }
    );

    await playBookCurlTurn({
      host,
      viewerShell: viewer,
      peekShell: peek,
      bitmaps,
      dir: 1,
      mode: '2d',
      durationMs: 40,
      fromProgress: 0.35,
      owner: 'test-2d'
    });

    expect(sources.some(s => s === bitmaps.front)).toBeTrue();
    expect(sources.some(s => s === bitmaps.under)).toBeTrue();
    const frontN = sources.filter(s => s === bitmaps.front).length;
    const underN = sources.filter(s => s === bitmaps.under).length;
    expect(underN / Math.max(1, frontN)).toBeLessThan(1.35);
    bitmaps.front.close();
    bitmaps.under.close();
  });

  it('prev (dir=-1) folds under (incoming); front is base', async () => {
    const { host, viewer, peek } = hostTrio();
    const bitmaps = await fakeBitmaps();
    const sources: unknown[] = [];
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    spyOn(CanvasRenderingContext2D.prototype, 'drawImage').and.callFake(
      function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        sources.push(args[0]);
        return (orig as (...a: unknown[]) => void).apply(this, args);
      }
    );

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 150;
    host.appendChild(canvas);
    paintBookCurlProgress(canvas, bitmaps, 0.5, -1, false, '2d');

    expect(sources.some(s => s === bitmaps.under)).toBeTrue();
    expect(sources.some(s => s === bitmaps.front)).toBeTrue();
    // Incoming (under) is the folding leaf; current (front) is the static base
    const frontN = sources.filter(s => s === bitmaps.front).length;
    const underN = sources.filter(s => s === bitmaps.under).length;
    expect(underN).toBeGreaterThanOrEqual(frontN);
    bitmaps.front.close();
    bitmaps.under.close();
  });

  it('3d next renders under only as base and front on flap', async () => {
    const { host, viewer, peek } = hostTrio();
    const bitmaps = await fakeBitmaps();
    const sources: unknown[] = [];
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    spyOn(CanvasRenderingContext2D.prototype, 'drawImage').and.callFake(
      function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        sources.push(args[0]);
        return (orig as (...a: unknown[]) => void).apply(this, args);
      }
    );

    await playBookCurlTurn({
      host,
      viewerShell: viewer,
      peekShell: peek,
      bitmaps,
      dir: 1,
      mode: '3d',
      durationMs: 40,
      fromProgress: 0.35,
      owner: 'test-3d'
    });

    expect(sources.some(s => s === bitmaps.front)).toBeTrue();
    expect(sources.some(s => s === bitmaps.under)).toBeTrue();
    const frontN = sources.filter(s => s === bitmaps.front).length;
    const underN = sources.filter(s => s === bitmaps.under).length;
    // Flap uses front (or surface) as verso, so under is never drawn on the flap
    expect(frontN).toBeGreaterThanOrEqual(underN);
    bitmaps.front.close();
    bitmaps.under.close();
  });

  it('null bitmaps commits without CSS clip-path flap (caller uses Fade)', async () => {
    const { host, viewer, peek } = hostTrio();
    const order: string[] = [];

    await playBookCurlTurn({
      host,
      viewerShell: viewer,
      peekShell: peek,
      bitmaps: null,
      dir: 1,
      mode: '2d',
      durationMs: 40,
      surfaceColor: '#0f172a',
      owner: 'test-null',
      commit: () => {
        order.push('commit');
      }
    });

    order.push('after');
    expect(order).toEqual(['commit', 'after']);
    expect(viewer.style.clipPath).toBe('');
    expect(host.querySelector('[data-book-curl-flap]')).toBeNull();
  });
});
