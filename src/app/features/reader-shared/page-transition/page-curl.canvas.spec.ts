import { curl2dFoldGeometry, drawCurl } from './page-curl.canvas';

function makeSource(w: number, h: number, fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return c;
}

describe('curl2dFoldGeometry', () => {
  it('returns clip-path polygons and fold tips for mid curl', () => {
    const geo = curl2dFoldGeometry(0.4, 200, 300);
    expect(geo.factor).toBe(0.4);
    expect(geo.bottomFold.x).toBeCloseTo(80, 5);
    expect(geo.bottomFold.y).toBe(300);
    expect(geo.frontClipPolygon.startsWith('polygon(')).toBeTrue();
    expect(geo.flapClipPolygon.startsWith('polygon(')).toBeTrue();
    expect(geo.frontClipPolygon).toContain('0px 0px');
    expect(geo.flapClipPolygon.split(',').length).toBe(4);
  });

  it('clamps factor to [0,1]', () => {
    expect(curl2dFoldGeometry(-1, 100, 100).factor).toBe(0);
    expect(curl2dFoldGeometry(2, 100, 100).factor).toBe(1);
  });
});

describe('drawCurl', () => {
  it('2d mode never drawImage()s the back bitmap on the flap', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    const front = makeSource(100, 150, '#f00');
    const back = makeSource(100, 150, '#0f0');
    const under = makeSource(100, 150, '#00f');

    const spy = spyOn(ctx, 'drawImage').and.callThrough();
    drawCurl(ctx, {
      front,
      back,
      under,
      curl: -0.45,
      mode: '2d',
      mirror: false,
      surfaceColor: '#111'
    });

    const sources = spy.calls.allArgs().map(args => args[0]);
    expect(sources.some(s => s === under)).toBeTrue();
    expect(sources.some(s => s === front)).toBeTrue();
    expect(sources.some(s => s === back)).toBeFalse();
  });

  it('3d mode drawImage()s the back bitmap as verso', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    const front = makeSource(100, 150, '#f00');
    const back = makeSource(100, 150, '#0f0');
    const under = makeSource(100, 150, '#00f');

    const spy = spyOn(ctx, 'drawImage').and.callThrough();
    drawCurl(ctx, {
      front,
      back,
      under,
      curl: -0.45,
      mode: '3d',
      mirror: false,
      surfaceColor: '#111'
    });

    const sources = spy.calls.allArgs().map(args => args[0]);
    expect(sources.some(s => s === back)).toBeTrue();
  });

  it('3d mode falls back to front (never under) when back is null', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    const front = makeSource(100, 150, '#f00');
    const under = makeSource(100, 150, '#00f');

    const spy = spyOn(ctx, 'drawImage').and.callThrough();
    drawCurl(ctx, {
      front,
      back: null,
      under,
      curl: -0.45,
      mode: '3d',
      mirror: false,
      surfaceColor: '#111'
    });

    const sources = spy.calls.allArgs().map(args => args[0]);
    // 'under' must only be drawn once as background, never on the flap
    expect(sources.filter(s => s === under).length).toBe(1);
    // 'front' drawn on the uncurled side and on the flap
    expect(sources.filter(s => s === front).length).toBeGreaterThanOrEqual(2);
  });
});
