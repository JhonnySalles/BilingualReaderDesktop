import { Injectable, signal } from '@angular/core';

export interface FlipOptions {
  duration?: number;
  easing?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LayoutAnimationService {
  private firstRects = new Map<string, DOMRect>();
  private isCapturing = false;
  private animTimeout: any = null;

  /** Signal indicating if layout animation is actively running */
  isAnimating = signal<boolean>(false);

  /**
   * Captures screen positions (bounding rects) of all elements
   * with [data-flip-id] currently visible inside or near the viewport.
   */
  capture(root?: HTMLElement | null): void {
    this.firstRects.clear();
    const container = root || (typeof document !== 'undefined' ? document : null);
    if (!container) return;

    const elements = container.querySelectorAll<HTMLElement>('[data-flip-id]');
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1000;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;

    elements.forEach(el => {
      const id = el.getAttribute('data-flip-id');
      if (!id) return;

      const rect = el.getBoundingClientRect();
      // Only capture elements with non-zero dimensions and in/near visible screen
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= -150 &&
        rect.top <= vh + 150 &&
        rect.right >= -150 &&
        rect.left <= vw + 150
      ) {
        this.firstRects.set(id, rect);
      }
    });

    this.isCapturing = this.firstRects.size > 0;
  }

  /**
   * Executes FLIP transition synchronously immediately after DOM mutation
   * without waiting for macrotasks (setTimeout), ensuring Chromium does NOT
   * paint an un-animated frame.
   */
  playSync(options?: FlipOptions, root?: HTMLElement | null): void {
    if (!this.isCapturing || this.firstRects.size === 0) {
      this.firstRects.clear();
      this.isCapturing = false;
      return;
    }

    const duration = options?.duration ?? 340;
    const easing = options?.easing ?? 'cubic-bezier(0.2, 0, 0, 1)';
    const captured = new Map(this.firstRects);
    this.firstRects.clear();
    this.isCapturing = false;

    const container = root || (typeof document !== 'undefined' ? document : null);
    if (!container) return;

    const elements = container.querySelectorAll<HTMLElement>('[data-flip-id]');
    let animatedCount = 0;

    elements.forEach(el => {
      const id = el.getAttribute('data-flip-id');
      if (!id || !captured.has(id)) return;

      const first = captured.get(id)!;
      const last = el.getBoundingClientRect();

      if (last.width <= 0 || last.height <= 0) return;

      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;
      const scaleX = first.width / last.width;
      const scaleY = first.height / last.height;

      // Ignore tiny/negligible differences (e.g. within 1.5px and 2% scale)
      const isMoved = Math.abs(deltaX) > 1.5 || Math.abs(deltaY) > 1.5;
      const isResized = Math.abs(scaleX - 1) > 0.02 || Math.abs(scaleY - 1) > 0.02;

      if (!isMoved && !isResized) return;

      animatedCount++;

      // Suppress CSS transitions during Web Animations execution to prevent conflicts
      const prevTransition = el.style.transition;
      el.style.transition = 'none';

      try {
        const anim = el.animate(
          [
            {
              transformOrigin: 'top left',
              transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`
            },
            {
              transformOrigin: 'top left',
              transform: 'translate3d(0, 0, 0) scale(1, 1)'
            }
          ],
          {
            duration,
            easing,
            fill: 'none'
          }
        );

        const restore = () => {
          el.style.transition = prevTransition;
        };
        anim.onfinish = restore;
        anim.oncancel = restore;
      } catch (e) {
        el.style.transition = prevTransition;
      }
    });

    if (animatedCount > 0) {
      this.isAnimating.set(true);
      if (this.animTimeout) clearTimeout(this.animTimeout);
      this.animTimeout = setTimeout(() => {
        this.isAnimating.set(false);
        this.animTimeout = null;
      }, duration + 20);
    }
  }

  /**
   * Fallback async play method
   */
  play(options?: FlipOptions, root?: HTMLElement | null): void {
    this.playSync(options, root);
  }
}
