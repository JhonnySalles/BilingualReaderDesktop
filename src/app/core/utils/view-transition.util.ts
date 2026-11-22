import { ViewTransitionInfo } from '@angular/router';

let activeTransition: any = null;

/**
 * Lifecycle handler for Angular Router's `withViewTransitions`.
 * - Silently intercepts normal browser transition aborts (`TimeoutError`, `InvalidStateError`, `AbortError`)
 *   so they do not leak into Sentry / `window.onunhandledrejection`.
 * - Cancels previous overlapping transitions to prevent `InvalidStateError` conflicts.
 * - Skips transitions when the window/document is hidden or backgrounded.
 */
export function onViewTransitionCreated(info: ViewTransitionInfo): void {
  const transition = info?.transition;
  if (!transition) return;

  // 1. If document is hidden/backgrounded, skip transition immediately to prevent timeouts
  if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden')) {
    try {
      transition.skipTransition();
    } catch {
      /* ignore */
    }
  }

  // 2. If there is an active transition that hasn't finished, skip it cleanly before starting new one
  if (activeTransition && activeTransition !== transition) {
    try {
      activeTransition.skipTransition();
    } catch {
      /* ignore */
    }
  }
  activeTransition = transition;

  const handleAbort = (err: unknown) => {
    if (!err) return;
    const name = (err as any)?.name || '';
    const message = err instanceof Error ? err.message : String(err);
    if (
      name === 'TimeoutError' ||
      name === 'InvalidStateError' ||
      name === 'AbortError' ||
      message.includes('Transition was aborted')
    ) {
      // Normal browser aborts: DOM timeout, invalid state or concurrent navigation
      return;
    }
    console.warn('[ViewTransition] Rejection in view transition:', err);
  };

  if (transition.ready && typeof transition.ready.catch === 'function') {
    transition.ready.catch(handleAbort);
  }
  if (transition.updateCallbackDone && typeof transition.updateCallbackDone.catch === 'function') {
    transition.updateCallbackDone.catch(handleAbort);
  }
  if (transition.finished && typeof transition.finished.catch === 'function') {
    transition.finished
      .catch(handleAbort)
      .finally(() => {
        if (activeTransition === transition) {
          activeTransition = null;
        }
      });
  }
}

