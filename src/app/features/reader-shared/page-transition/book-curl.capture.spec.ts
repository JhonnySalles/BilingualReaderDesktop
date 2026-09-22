import {
  pairBookCurlBitmaps,
  dataUrlToOpaqueBitmap,
  captureBookPageBitmaps
} from './book-curl.capture';

function tinyPngDataUrl(): string {
  return (
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  );
}

describe('book-curl.capture (offscreen cache helpers)', () => {
  it('pairBookCurlBitmaps keeps dimensions and surface color', async () => {
    const front = await createImageBitmap(new ImageData(40, 60));
    const under = await createImageBitmap(new ImageData(40, 60));
    const paired = pairBookCurlBitmaps(front, under, '#0f172a');
    expect(paired.width).toBe(40);
    expect(paired.height).toBe(60);
    expect(paired.surfaceColor).toBe('#0f172a');
    expect(paired.front).toBe(front);
    expect(paired.under).toBe(under);
    front.close();
    under.close();
  });

  it('dataUrlToOpaqueBitmap decodes a PNG to the requested size', async () => {
    const bmp = await dataUrlToOpaqueBitmap(tinyPngDataUrl(), 32, 48, '#0f172a');
    expect(bmp).toBeTruthy();
    expect(bmp!.width).toBe(32);
    expect(bmp!.height).toBe(48);
    bmp!.close();
  });

  it('captureBookPageBitmaps is disabled (returns null)', async () => {
    const result = await captureBookPageBitmaps({});
    expect(result).toBeNull();
  });
});
