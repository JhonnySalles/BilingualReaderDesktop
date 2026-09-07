import { pageStyleAt, turnKeyframePositions } from './page-transition.math';
import {
  PageTransitionType,
  type TurnAxis
} from '../../../core/models/enums/page-transition.enums';

describe('page-transition.math', () => {
  const size = 800;

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
    it('slides with -position * size', () => {
      const s = pageStyleAt(PageTransitionType.Default, 0.5, 'x', size);
      expect(s.opacity).toBe(1);
      expect(s.transform).toContain('translateX(-400px)');
    });
  });

  describe('Fade', () => {
    for (const pos of [-1, -0.5, 0, 0.5, 1] as const) {
      it(`alpha = 1 - |${pos}|`, () => {
        const s = pageStyleAt(PageTransitionType.Fade, pos, 'x', size);
        expect(s.opacity).toBeCloseTo(1 - Math.abs(pos), 5);
      });
    }
  });

  describe('Zooming', () => {
    it('shrinks on negative position', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, -0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('scale(0.9)');
    });

    it('fades on positive position without shrink below 1', () => {
      const s = pageStyleAt(PageTransitionType.Zooming, 0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('scale(1)');
    });
  });

  describe('Depth', () => {
    it('keeps outgoing (pos<=0) full size', () => {
      const s = pageStyleAt(PageTransitionType.Depth, -0.5, 'x', size);
      expect(s.opacity).toBe(1);
      expect(s.zIndex).toBe(20);
      expect(s.transform).toBe('none');
    });

    it('scales incoming (pos>0)', () => {
      const s = pageStyleAt(PageTransitionType.Depth, 0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('scale(0.5)');
    });
  });

  describe('Stack', () => {
    it('scales underlap on negative position', () => {
      const s = pageStyleAt(PageTransitionType.Stack, -0.5, 'x', size);
      expect(s.opacity).toBeCloseTo(0.5, 5);
      expect(s.transform).toContain('scale(');
    });

    it('hides far positive position', () => {
      const s = pageStyleAt(PageTransitionType.Stack, 0.75, 'x', size);
      expect(s.opacity).toBe(0);
    });
  });

  describe('vertical axis', () => {
    it('uses translateY for Fade', () => {
      const s = pageStyleAt(PageTransitionType.Fade, 0.5, 'y' as TurnAxis, size);
      expect(s.transform).toContain('translateY(-400px)');
    });
  });

  describe('out of range', () => {
    it('returns opacity 0', () => {
      expect(pageStyleAt(PageTransitionType.Default, -1.5, 'x', size).opacity).toBe(0);
      expect(pageStyleAt(PageTransitionType.Default, 1.5, 'x', size).opacity).toBe(0);
    });
  });
});
