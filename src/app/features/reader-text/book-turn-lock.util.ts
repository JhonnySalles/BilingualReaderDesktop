/**
 * Pure helpers for book page-turn input locking (unit-testable).
 */

/** True when page-nav gestures must be ignored (one next/prev per turn cycle). */
export function isBookNavLocked(turningPage: boolean, driverActive: boolean): boolean {
  return turningPage || driverActive;
}
