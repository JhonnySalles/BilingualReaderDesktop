/**
 * Re-export transition types from core models so feature code can import
 * from the page-transition barrel.
 */
export {
  PageTransitionType,
  PAGE_TRANSITION_LABELS_PT,
  PAGE_TRANSITION_OPTIONS,
  PAGE_TURN_DURATION_MS,
  PAGE_TURN_EASING,
  isPageTransitionType,
  prefersReducedMotion
} from '../../../core/models/enums/page-transition.enums';

export type {
  TurnAxis,
  TurnDir,
  PageTurnStyle
} from '../../../core/models/enums/page-transition.enums';
