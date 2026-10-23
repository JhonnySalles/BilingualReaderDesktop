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

const activeScrollAnimations = new WeakMap<HTMLElement, () => void>();

function calculateScrollDuration(distance: number): number {
  const absDist = Math.abs(distance);
  if (absDist <= 0) return 0;
  if (absDist < 600) return 600;
  if (absDist < 2000) return 1200;
  if (absDist < 6000) return 2400;
  if (absDist < 20000) return 3800;
  if (absDist < 60000) return 5200;
  return 7000; // Duração calma de ~7s para listas gigantescas (~1 linha por frame, dando tempo para as capas carregarem)
}

/**
 * Curva suave de 3 fases: aceleração suave (15%) -> velocidade constante de cruzeiro (70%) -> desaceleração suave (15%).
 * Mantém os cards passando na tela de forma estável, legível e em ritmo calmo, sem pico violento no meio.
 */
function smoothTrapezoidalEasing(t: number): number {
  const a = 0.15; // 15% aceleração
  const d = 0.15; // 15% desaceleração
  const scale = 1 / (1 - (a + d) / 2); // 1 / 0.85 = ~1.17647

  if (t <= a) {
    // Fase de aceleração quadrática suave
    return scale * (t * t) / (2 * a);
  } else if (t <= 1 - d) {
    // Fase de velocidade de cruzeiro constante e linear
    const distAcc = (scale * a) / 2;
    return distAcc + scale * (t - a);
  } else {
    // Fase de desaceleração quadrática suave até a parada
    const tau = 1 - t;
    return 1 - scale * (tau * tau) / (2 * d);
  }
}

export function cancelScrollAnimation(element: HTMLElement | null | undefined): void {
  if (!element) return;
  const cancel = activeScrollAnimations.get(element);
  if (cancel) {
    cancel();
    activeScrollAnimations.delete(element);
  }
}

export function smoothScrollTo(element: HTMLElement | null | undefined, top: number): void {
  if (!element) return;

  cancelScrollAnimation(element);

  const startTop = element.scrollTop ?? 0;
  const distance = top - startTop;
  if (Math.abs(distance) < 2) {
    element.scrollTop = top;
    return;
  }

  if (typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') {
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top, behavior: 'smooth' });
    } else {
      element.scrollTop = top;
    }
    return;
  }

  const duration = calculateScrollDuration(distance);
  const startTime = performance.now();
  let cancelled = false;

  const onUserInteraction = (): void => {
    cancelled = true;
    cleanup();
  };

  const cleanup = (): void => {
    if (typeof element.removeEventListener === 'function') {
      element.removeEventListener('wheel', onUserInteraction);
      element.removeEventListener('touchstart', onUserInteraction);
      element.removeEventListener('pointerdown', onUserInteraction);
    }
    activeScrollAnimations.delete(element);
  };

  if (typeof element.addEventListener === 'function') {
    element.addEventListener('wheel', onUserInteraction, { passive: true, once: true });
    element.addEventListener('touchstart', onUserInteraction, { passive: true, once: true });
    element.addEventListener('pointerdown', onUserInteraction, { passive: true, once: true });
  }

  const cancelFn = (): void => {
    cancelled = true;
    cleanup();
  };
  activeScrollAnimations.set(element, cancelFn);

  const step = (currentTime: number): void => {
    if (cancelled) return;
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = smoothTrapezoidalEasing(progress);

    element.scrollTop = Math.round(startTop + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.scrollTop = top;
      cleanup();
    }
  };

  requestAnimationFrame(step);
}

export function smoothScrollHorizontalTo(element: HTMLElement | null | undefined, left: number): void {
  if (!element) return;

  cancelScrollAnimation(element);

  const startLeft = element.scrollLeft ?? 0;
  const distance = left - startLeft;
  if (Math.abs(distance) < 2) {
    element.scrollLeft = left;
    return;
  }

  if (typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') {
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ left, behavior: 'smooth' });
    } else {
      element.scrollLeft = left;
    }
    return;
  }

  const duration = calculateScrollDuration(distance);
  const startTime = performance.now();
  let cancelled = false;

  const onUserInteraction = (): void => {
    cancelled = true;
    cleanup();
  };

  const cleanup = (): void => {
    if (typeof element.removeEventListener === 'function') {
      element.removeEventListener('wheel', onUserInteraction);
      element.removeEventListener('touchstart', onUserInteraction);
      element.removeEventListener('pointerdown', onUserInteraction);
    }
    activeScrollAnimations.delete(element);
  };

  if (typeof element.addEventListener === 'function') {
    element.addEventListener('wheel', onUserInteraction, { passive: true, once: true });
    element.addEventListener('touchstart', onUserInteraction, { passive: true, once: true });
    element.addEventListener('pointerdown', onUserInteraction, { passive: true, once: true });
  }

  const cancelFn = (): void => {
    cancelled = true;
    cleanup();
  };
  activeScrollAnimations.set(element, cancelFn);

  const step = (currentTime: number): void => {
    if (cancelled) return;
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = smoothTrapezoidalEasing(progress);

    element.scrollLeft = Math.round(startLeft + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.scrollLeft = left;
      cleanup();
    }
  };

  requestAnimationFrame(step);
}
