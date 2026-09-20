import { drawCurl } from './page-curl.canvas';

function makeSource(w: number, h: number, fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return c;
}

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
      dir: 1,
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
      dir: 1,
      surfaceColor: '#111'
    });

    const sources = spy.calls.allArgs().map(args => args[0]);
    expect(sources.some(s => s === back)).toBeTrue();
  });
});
