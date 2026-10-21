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
    it('should call scrollTo with smooth behavior', () => {
      const mockEl = { scrollTo: jest.fn() } as unknown as HTMLElement;
      smoothScrollTo(mockEl, 1200);
      expect(mockEl.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' });
    });

    it('should safely do nothing when element is null or undefined', () => {
      expect(() => smoothScrollTo(null, 100)).not.toThrow();
      expect(() => smoothScrollTo(undefined, 100)).not.toThrow();
    });
  });

  describe('smoothScrollHorizontalTo', () => {
    it('should call scrollTo with smooth behavior for horizontal scroll', () => {
      const mockEl = { scrollTo: jest.fn() } as unknown as HTMLElement;
      smoothScrollHorizontalTo(mockEl, 800);
      expect(mockEl.scrollTo).toHaveBeenCalledWith({ left: 800, behavior: 'smooth' });
    });

    it('should safely do nothing when element is null or undefined', () => {
      expect(() => smoothScrollHorizontalTo(null, 100)).not.toThrow();
      expect(() => smoothScrollHorizontalTo(undefined, 100)).not.toThrow();
    });
  });
});
