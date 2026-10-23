import {
  computeScrollEdgesVisibility,
  isBigScroll,
  smoothScrollTo,
  smoothScrollHorizontalTo
} from './scroll-edges.util';

describe('scroll-edges.util', () => {
  describe('computeScrollEdgesVisibility', () => {
    it('should return false for both when content does not exceed container height', () => {
      const res = computeScrollEdgesVisibility(0, 500, 500, 200);
      expect(res.canScrollUp).toBe(false);
      expect(res.canScrollDown).toBe(false);
    });

    it('should detect when at top of long content', () => {
      // scrollHeight = 1500, clientHeight = 500, maxScroll = 1000
      const res = computeScrollEdgesVisibility(0, 1500, 500, 200);
      expect(res.canScrollUp).toBe(false);
      expect(res.canScrollDown).toBe(true);
    });

    it('should detect when in middle of long content', () => {
      // scrollTop = 400, scrollHeight = 1500, clientHeight = 500, maxScroll = 1000, remaining = 600
      const res = computeScrollEdgesVisibility(400, 1500, 500, 200);
      expect(res.canScrollUp).toBe(true);
      expect(res.canScrollDown).toBe(true);
    });

    it('should detect when at bottom of long content', () => {
      // scrollTop = 900, maxScroll = 1000, remaining = 100 (< threshold 200)
      const res = computeScrollEdgesVisibility(900, 1500, 500, 200);
      expect(res.canScrollUp).toBe(true);
      expect(res.canScrollDown).toBe(false);
    });
  });

  describe('isBigScroll', () => {
    it('should return false for small scroll deltas', () => {
      expect(isBigScroll(50, 0, 160)).toBe(false);
      expect(isBigScroll(150, 50, 160)).toBe(false);
      expect(isBigScroll(20, 100, 160)).toBe(false);
    });

    it('should return true when scroll delta meets or exceeds minDistance', () => {
      expect(isBigScroll(160, 0, 160)).toBe(true);
      expect(isBigScroll(300, 50, 160)).toBe(true);
      expect(isBigScroll(0, 200, 160)).toBe(true);
    });
  });

  describe('smoothScrollTo', () => {
    it('should fallback to element.scrollTo with smooth behavior when rAF is undefined', () => {
      const mockEl = { scrollTo: jest.fn() } as unknown as HTMLElement;
      smoothScrollTo(mockEl, 1200);
      expect(mockEl.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' });
    });

    it('should animate scrollTop using requestAnimationFrame when available', () => {
      let rAfCallback: ((time: number) => void) | null = null;
      const originalRaf = (global as any).requestAnimationFrame;
      (global as any).requestAnimationFrame = jest.fn((cb: any) => {
        rAfCallback = cb;
        return 1;
      });

      try {
        const mockEl = {
          scrollTop: 0,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        } as unknown as HTMLElement;

        smoothScrollTo(mockEl, 1200);
        expect((global as any).requestAnimationFrame).toHaveBeenCalled();
        expect(mockEl.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), expect.any(Object));

        if (rAfCallback) {
          (rAfCallback as any)(performance.now() + 600);
        }
        expect(mockEl.scrollTop).toBeGreaterThan(0);
      } finally {
        (global as any).requestAnimationFrame = originalRaf;
      }
    });

    it('should immediately set scrollTop if distance is negligible', () => {
      const mockEl = {
        scrollTop: 100,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      } as unknown as HTMLElement;

      smoothScrollTo(mockEl, 101);
      expect(mockEl.scrollTop).toBe(101);
    });

    it('should safely do nothing when element is null or undefined', () => {
      expect(() => smoothScrollTo(null, 100)).not.toThrow();
      expect(() => smoothScrollTo(undefined, 100)).not.toThrow();
    });
  });

  describe('smoothScrollHorizontalTo', () => {
    it('should fallback to element.scrollTo with smooth behavior when rAF is undefined', () => {
      const mockEl = { scrollTo: jest.fn() } as unknown as HTMLElement;
      smoothScrollHorizontalTo(mockEl, 800);
      expect(mockEl.scrollTo).toHaveBeenCalledWith({ left: 800, behavior: 'smooth' });
    });

    it('should animate scrollLeft using requestAnimationFrame when available', () => {
      let rAfCallback: ((time: number) => void) | null = null;
      const originalRaf = (global as any).requestAnimationFrame;
      (global as any).requestAnimationFrame = jest.fn((cb: any) => {
        rAfCallback = cb;
        return 1;
      });

      try {
        const mockEl = {
          scrollLeft: 0,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        } as unknown as HTMLElement;

        smoothScrollHorizontalTo(mockEl, 800);
        expect((global as any).requestAnimationFrame).toHaveBeenCalled();
        expect(mockEl.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), expect.any(Object));

        if (rAfCallback) {
          (rAfCallback as any)(performance.now() + 400);
        }
        expect(mockEl.scrollLeft).toBeGreaterThan(0);
      } finally {
        (global as any).requestAnimationFrame = originalRaf;
      }
    });

    it('should safely do nothing when element is null or undefined', () => {
      expect(() => smoothScrollHorizontalTo(null, 100)).not.toThrow();
      expect(() => smoothScrollHorizontalTo(undefined, 100)).not.toThrow();
    });
  });
});
