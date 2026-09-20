import { captureBookPageBitmaps } from './book-curl.capture';

function makeShell(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.style.width = '100px';
  el.style.height = '150px';
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 150,
      right: 100,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
  });
  document.body.appendChild(el);
  return el;
}

function tinyPngDataUrl(): string {
  // 1x1 opaque PNG
  return (
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  );
}

describe('captureBookPageBitmaps', () => {
  afterEach(() => {
    for (const id of ['viewer-shell', 'peek-shell']) {
      document.getElementById(id)?.remove();
    }
  });

  it('calls onFrontReady before under capture while viewer was still the first target', async () => {
    const viewer = makeShell('viewer-shell');
    const peek = makeShell('peek-shell');
    const order: string[] = [];
    let frontReadySeen = false;

    const captured = await captureBookPageBitmaps({
      viewerShell: viewer,
      peekShell: peek,
      surfaceColor: '#0f172a',
      captureRect: async () => {
        if (!frontReadySeen) {
          order.push('capture-front');
          expect(viewer.style.visibility).not.toBe('hidden');
          expect(peek.style.visibility).toBe('hidden');
        } else {
          order.push('capture-under');
          // viewerShell is intentionally NOT hidden to prevent flashing/blinking
          expect(viewer.style.visibility).not.toBe('hidden');
        }
        return tinyPngDataUrl();
      },
      onFrontReady: async () => {
        frontReadySeen = true;
        order.push('front-ready');
      },
      hideChrome: () => {
        order.push('hide-chrome');
        return () => order.push('restore-chrome');
      }
    });

    expect(captured).toBeTruthy();
    expect(order).toEqual([
      'hide-chrome',
      'capture-front',
      'front-ready',
      'capture-under',
      'restore-chrome'
    ]);
    captured!.front.close();
    captured!.under.close();
  });
});
