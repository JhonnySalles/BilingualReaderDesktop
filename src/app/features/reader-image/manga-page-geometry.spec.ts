import { MangaFitMode } from '../../core/models';
import {
  pageFitRect,
  pageFitRectScrolled,
  pageImageClasses,
  pageWrapperClasses,
  pageWrapperStyle
} from './manga-page-geometry';

describe('manga-page-geometry', () => {
  describe('pageFitRect', () => {
    const iw = 800;
    const ih = 1200;
    const W = 1000;
    const H = 800;

    it('FitWidth scales with zoom and does not saturate at 100%', () => {
      const r1 = pageFitRect(iw, ih, W, H, MangaFitMode.FitWidth, 1);
      expect(r1.w).toBeCloseTo(1000, 0);
      expect(r1.h).toBeCloseTo(1500, 0);

      const r3 = pageFitRect(iw, ih, W, H, MangaFitMode.FitWidth, 3);
      expect(r3.w).toBeCloseTo(3000, 0);
      expect(r3.h).toBeCloseTo(4500, 0);

      const r05 = pageFitRect(iw, ih, W, H, MangaFitMode.FitWidth, 0.5);
      expect(r05.w).toBeCloseTo(500, 0);
      expect(r05.h).toBeCloseTo(750, 0);
    });

    it('FitHeight scales with zoom', () => {
      const r1 = pageFitRect(iw, ih, W, H, MangaFitMode.FitHeight, 1);
      expect(r1.h).toBeCloseTo(800, 0);
      const r2 = pageFitRect(iw, ih, W, H, MangaFitMode.FitHeight, 2);
      expect(r2.h).toBeCloseTo(1600, 0);
    });

    it('Original uses natural size * zoom', () => {
      const r = pageFitRect(iw, ih, W, H, MangaFitMode.Original, 2);
      expect(r.w).toBe(1600);
      expect(r.h).toBe(2400);
    });
  });

  describe('pageFitRectScrolled', () => {
    it('shifts the centered rect by scroll offsets', () => {
      const base = pageFitRect(800, 1200, 1000, 800, MangaFitMode.FitWidth, 1);
      const scrolled = pageFitRectScrolled(
        800,
        1200,
        1000,
        800,
        MangaFitMode.FitWidth,
        1,
        40,
        120
      );
      expect(scrolled.x).toBeCloseTo(base.x - 40, 5);
      expect(scrolled.y).toBeCloseTo(base.y - 120, 5);
      expect(scrolled.w).toBeCloseTo(base.w, 5);
      expect(scrolled.h).toBeCloseTo(base.h, 5);
    });
  });

  describe('pageWrapperClasses / pageImageClasses', () => {
    it('uses max-w-none when zoom > 1', () => {
      expect(pageWrapperClasses(2)).toContain('max-w-none');
      expect(pageImageClasses(MangaFitMode.FitWidth, 2)).toContain('max-w-none');
    });

    it('uses max-w-full when zoom <= 1', () => {
      expect(pageWrapperClasses(0.5)).toContain('max-w-full');
      expect(pageImageClasses(MangaFitMode.FitWidth, 1)).toContain('max-w-full');
    });
  });

  describe('pageWrapperStyle', () => {
    it('returns width percent for FitWidth', () => {
      expect(pageWrapperStyle(MangaFitMode.FitWidth, 1.5).widthPercent).toBe(150);
      expect(pageWrapperStyle(MangaFitMode.FitWidth, 1.5).heightPercent).toBeNull();
    });

    it('returns height percent for FitHeight', () => {
      expect(pageWrapperStyle(MangaFitMode.FitHeight, 2).heightPercent).toBe(200);
    });
  });
});
