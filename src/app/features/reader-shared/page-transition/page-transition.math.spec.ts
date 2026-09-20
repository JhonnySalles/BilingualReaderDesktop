import {
  accelerateDecelerate,
  pageStyleAt,
  samplePositions,
  turnKeyframePositions
} from './page-transition.math';
import {
  PageTransitionType,
  type TurnAxis
} from '../../../core/models/enums/page-transition.enums';

describe('page-transition.math', () => {
  const size = 800;

  describe('accelerateDecelerate / samplePositions', () => {
    it('maps 0→0 and 1→1', () => {
      expect(accelerateDecelerate(0)).toBe(0);
      expect(accelerateDecelerate(1)).toBe(1);
    });

    it('is monotonic increasing', () => {
      let prev = -1;
      for (let i = 0; i <= 20; i++) {
        const v = accelerateDecelerate(i / 20);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    });

    it('samplePositions hits exact endpoints', () => {
      const s = samplePositions(0, -1, 24);
      expect(s[0]).toBe(0);
      expect(s[s.length - 1]).toBe(-1);
      expect(s.length).toBe(25);
    });
  });

  it('turnKeyframePositions next: outgoing 0→-1, incoming 1→0', () => {
    const { outgoing, incoming } = turnKeyframePositions(1);
    expect(outgoing[0]).toBe(0);
    expect(outgoing[outgoing.length - 1]).toBe(-1);
    expect(incoming[0]).toBe(1);
    expect(incoming[incoming.length - 1]).toBe(0);
  });

  it('turnKeyframePositions prev: outgoing 0→1, incoming -1→0', () => {
    const { outgoing, incoming } = turnKeyframePositions(-1);
    expect(outgoing[outgoing.length - 1]).toBe(1);
    expect(incoming[0]).toBe(-1);
  });

  describe('Default', () => {
    it('slides with position * size', () => {
      const s = pageStyleAt(PageTransitionType.Default, 0.5, 'x', size);
      expect(s.opacity).toBe(1);
      expect(s.transform).toContain('translateX(400px)');
      expect(s.elevated).toBe(false);
    });
  });

  describe('Fade', () => {
    for (const pos of [-1, -0.5, 0, 0.5, 1] as const) {
      it(`alpha = 1 - |${pos}| and transform is none`, () => {
        const s = pageStyleAt(PageTransitionType.Fade, pos, 'x', size);
        expect(s.opacity).toBeCloseTo(1 - Math.abs(pos), 5);
        expect(s.transform).toBe('none');
      });
    }
  });

  describe('Zooming', () => {
    it('scales only on negative position', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, -0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('translateX(-400px)');
      expect(s.transform).toContain('scale(0.9)');
    });

    it('does not scale on positive position', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, 0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('translateX(400px)');
      expect(s.transform).not.toContain('scale(');
    });

    it('is full size and centered at position 0', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, 0, 'x', size);
      expect(s.opacity).toBe(1);
      expect(s.transform).toContain('translateX(0px)');
      expect(s.transform).not.toContain('scale(');
    });
  });

  describe('Depth', () => {
    it('slides elevated top layer on negative position', () => {
      const s = pageStyleAt(PageTransitionType.Depth, -0.5, 'x', size);
      expect(s.opacity).toBe(1);
      expect(s.elevated).toBe(true);
      expect(s.transform).toContain('translateX(-400px)');
      expect(s.shadow).toBe(0.5);
    });

    it('scales and fades background on positive position without clamp', () => {
      const s = pageStyleAt(PageTransitionType.Depth, 0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.elevated).toBe(false);
      expect(s.transform).toContain('scale(0.5)');
      expect(s.shadow).toBe(0);
    });
  });

  describe('Stack manga', () => {
    it('slides elevated on negative position', () => {
      const s = pageStyleAt(PageTransitionType.Stack, -0.5, 'x', size, 'manga');
      expect(s.opacity).toBe(1);
      expect(s.elevated).toBe(true);
      expect(s.transform).toContain('translateX(-400px)');
    });

    it('anchors underneath on positive position', () => {
      const s = pageStyleAt(PageTransitionType.Stack, 0.5, 'x', size, 'manga');
      expect(s.opacity).toBe(1);
      expect(s.elevated).toBe(false);
      expect(s.transform).toBe('none');
    });
  });

  describe('Stack book', () => {
    it('scales underneath on negative position (no elevation)', () => {
      const s = pageStyleAt(PageTransitionType.Stack, -0.5, 'x', size, 'book');
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.elevated).toBe(false);
      expect(s.transform).toContain('scale(0.875)');
    });

    it('slides elevated on positive position (documented exception)', () => {
      const s = pageStyleAt(PageTransitionType.Stack, 0.2, 'x', size, 'book');
      expect(s.opacity).toBe(1);
      expect(s.elevated).toBe(true);
      expect(s.transform).toContain('translateX(320px)');
    });

    it('is invisible and anchored past 0.5', () => {
      const s = pageStyleAt(PageTransitionType.Stack, 0.75, 'x', size, 'book');
      expect(s.opacity).toBe(0);
      expect(s.elevated).toBe(false);
      expect(s.transform).toBe('none');
    });
  });

  describe('vertical axis', () => {
    it('uses translateY for Default', () => {
      const s = pageStyleAt(PageTransitionType.Default, 0.5, 'y' as TurnAxis, size);
      expect(s.transform).toContain('translateY(400px)');
    });

    it('uses translateY for Zooming', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, 0.5, 'y' as TurnAxis, size);
      expect(s.transform).toContain('translateY(400px)');
    });
  });

  describe('out of range', () => {
    it('returns opacity 0', () => {
      expect(pageStyleAt(PageTransitionType.Default, -1.5, 'x', size).opacity).toBe(0);
      expect(pageStyleAt(PageTransitionType.Default, 1.5, 'x', size).opacity).toBe(0);
    });
  });

  describe('elevation invariant', () => {
    const effects = [
      PageTransitionType.Default,
      PageTransitionType.Fade,
      PageTransitionType.Zooming,
      PageTransitionType.Depth,
      PageTransitionType.Stack,
      PageTransitionType.CurlPage
    ];
    const positions = [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1];

    it('manga: position < 0 is elevated (when effect elevates)', () => {
      for (const effect of effects) {
        if (effect === PageTransitionType.Default || effect === PageTransitionType.Zooming) {
          continue; // these never elevate
        }
        for (const pos of positions) {
          if (pos >= 0) continue;
          const s = pageStyleAt(effect, pos, 'x', size, 'manga');
          if (effect === PageTransitionType.Fade) {
            expect(s.elevated).toBe(true);
          } else if (
            effect === PageTransitionType.Depth ||
            effect === PageTransitionType.Stack ||
            effect === PageTransitionType.CurlPage
          ) {
            expect(s.elevated).withContext(`${effect} @ ${pos}`).toBe(true);
          }
        }
      }
    });

    it('book Stack is the exception: elevates position > 0', () => {
      expect(pageStyleAt(PageTransitionType.Stack, -0.5, 'x', size, 'book').elevated).toBe(false);
      expect(pageStyleAt(PageTransitionType.Stack, 0.2, 'x', size, 'book').elevated).toBe(true);
    });

    it('manga Stack positive side does not translate', () => {
      for (const pos of [0.25, 0.5, 0.75, 1]) {
        const s = pageStyleAt(PageTransitionType.Stack, pos, 'x', size, 'manga');
        expect(s.transform).withContext(`pos=${pos}`).toBe('none');
      }
    });
  });
});
