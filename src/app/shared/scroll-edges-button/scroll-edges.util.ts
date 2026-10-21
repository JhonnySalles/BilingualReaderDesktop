/**
 * Utilitários puros para cálculo de visibilidade e navegação de bordas de rolagem.
 */

export interface ScrollEdgesVisibility {
  canScrollUp: boolean;
  canScrollDown: boolean;
}

export function computeScrollEdgesVisibility(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = 200
): ScrollEdgesVisibility {
  if (scrollHeight <= clientHeight) {
    return { canScrollUp: false, canScrollDown: false };
  }

  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  const canScrollUp = scrollTop > threshold;
  const canScrollDown = maxScroll > threshold && (maxScroll - scrollTop) > threshold;

  return { canScrollUp, canScrollDown };
}

/**
 * Determina se a distância percorrida desde a última parada é suficiente para ativar os botões de salto.
 */
export function isBigScroll(
  currentPos: number,
  lastRestPos: number,
  minDistance: number = 160
): boolean {
  return Math.abs(currentPos - lastRestPos) >= minDistance;
}

export function smoothScrollTo(element: HTMLElement | null | undefined, top: number): void {
  if (!element) return;
  element.scrollTo({ top, behavior: 'smooth' });
}

export function smoothScrollHorizontalTo(element: HTMLElement | null | undefined, left: number): void {
  if (!element) return;
  element.scrollTo({ left, behavior: 'smooth' });
}
