/** Scroll/pan helpers for the manga image reader (pure, DOM-agnostic where possible). */

export const SCROLL_EDGE_PX = 2;
export const SCROLL_STEP_RATIO = 0.9;
export const PAGE_TURN_RATIO = 0.5;
/** Velocity (px/s) that commits a page turn even below PAGE_TURN_RATIO. */
export const PAGE_FLING_PX_PER_S = 600;
export const DRAG_THRESHOLD_PX = 5;

export type ScrollAxis = 'x' | 'y';
export type ScrollDir = 1 | -1;

export interface SlotOverflow {
  canUp: boolean;
  canDown: boolean;
  canLeft: boolean;
  canRight: boolean;
  maxScrollX: number;
  maxScrollY: number;
}

export function readSlotOverflow(el: HTMLElement, edge = SCROLL_EDGE_PX): SlotOverflow {
  const maxScrollX = el.scrollWidth - el.clientWidth;
  const maxScrollY = el.scrollHeight - el.clientHeight;
  return {
    maxScrollX,
    maxScrollY,
    canLeft: maxScrollX > edge && el.scrollLeft > edge,
    canRight: maxScrollX > edge && el.scrollLeft < maxScrollX - edge,
    canUp: maxScrollY > edge && el.scrollTop > edge,
    canDown: maxScrollY > edge && el.scrollTop < maxScrollY - edge
  };
}

/** True if the slot can scroll further in the given axis/direction (dir > 0 = down/right). */
export function canScrollSlot(
  el: HTMLElement,
  axis: ScrollAxis,
  dir: ScrollDir,
  edge = SCROLL_EDGE_PX
): boolean {
  const o = readSlotOverflow(el, edge);
  if (axis === 'y') return dir > 0 ? o.canDown : o.canUp;
  return dir > 0 ? o.canRight : o.canLeft;
}

/**
 * Column reading for next/prev (click zones + keyboard), not drag.
 * Forward LTR: down → right+top → page. Back LTR: up → left+bottom → page.
 * RTL swaps left/right.
 */
export type ColumnAction =
  | { kind: 'scrollY'; delta: number }
  | { kind: 'columnForward'; deltaX: number }
  | { kind: 'columnBack'; deltaX: number }
  | { kind: 'page' };

export function planColumnStep(opts: {
  overflow: SlotOverflow;
  dir: ScrollDir;
  rtl: boolean;
  /** When false (vertical paged), only Y is used for column logic. */
  allowHorizontalColumns: boolean;
  clientWidth: number;
  clientHeight: number;
  stepRatio?: number;
}): ColumnAction {
  const step = opts.stepRatio ?? SCROLL_STEP_RATIO;
  const dy = opts.clientHeight * step;
  const dx = opts.clientWidth * step;
  const o = opts.overflow;
  const forward = opts.dir > 0;

  if (forward) {
    if (o.canDown) return { kind: 'scrollY', delta: dy };
    if (opts.allowHorizontalColumns) {
      const canSide = opts.rtl ? o.canLeft : o.canRight;
      if (canSide) {
        return { kind: 'columnForward', deltaX: opts.rtl ? -dx : dx };
      }
    }
    return { kind: 'page' };
  }

  if (o.canUp) return { kind: 'scrollY', delta: -dy };
  if (opts.allowHorizontalColumns) {
    const canSide = opts.rtl ? o.canRight : o.canLeft;
    if (canSide) {
      return { kind: 'columnBack', deltaX: opts.rtl ? dx : -dx };
    }
  }
  return { kind: 'page' };
}

/** Apply a column action to a slot element. Returns true if scroll was applied (stay on page). */
export function applyColumnAction(slot: HTMLElement, action: ColumnAction): boolean {
  if (action.kind === 'page') return false;
  if (action.kind === 'scrollY') {
    slot.scrollBy({ top: action.delta, behavior: 'smooth' });
    return true;
  }
  if (action.kind === 'columnForward') {
    const nextLeft = Math.min(
      slot.scrollLeft + action.deltaX,
      Math.max(0, slot.scrollWidth - slot.clientWidth)
    );
    slot.scrollTo({ left: nextLeft, top: 0, behavior: 'smooth' });
    return true;
  }
  // columnBack: move sideways and go to bottom
  const nextLeft = Math.max(
    0,
    Math.min(
      slot.scrollLeft + action.deltaX,
      Math.max(0, slot.scrollWidth - slot.clientWidth)
    )
  );
  const maxY = Math.max(0, slot.scrollHeight - slot.clientHeight);
  slot.scrollTo({ left: nextLeft, top: maxY, behavior: 'smooth' });
  return true;
}

export type PageLand = 'start' | 'end';

/** Scroll offsets for landing after a page change. */
export function pageLandOffsets(
  slot: HTMLElement,
  land: PageLand,
  rtl: boolean
): { top: number; left: number } {
  const maxX = Math.max(0, slot.scrollWidth - slot.clientWidth);
  const maxY = Math.max(0, slot.scrollHeight - slot.clientHeight);
  if (land === 'start') {
    return { top: 0, left: rtl ? maxX : 0 };
  }
  return { top: maxY, left: rtl ? 0 : maxX };
}

/**
 * Whether a drag-based page scrub should commit to the next/prev page.
 * `delta` is the viewport scroll delta along the paging axis (positive = forward in content coords).
 */
export function shouldCommitPageTurn(
  delta: number,
  pageSize: number,
  velocityPxPerS = 0,
  ratio = PAGE_TURN_RATIO,
  fling = PAGE_FLING_PX_PER_S
): boolean {
  if (pageSize <= 0) return false;
  if (Math.abs(velocityPxPerS) >= fling && Math.sign(velocityPxPerS) === Math.sign(delta || velocityPxPerS)) {
    return true;
  }
  return Math.abs(delta) >= pageSize * ratio;
}

/** Resolve which page index to land on after a pager drag. */
export function resolvePagerDragTarget(opts: {
  startPage: number;
  delta: number;
  pageSize: number;
  pageCount: number;
  /** Invert for RTL horizontal (drag right → previous in LTR sense maps differently). */
  invert?: boolean;
  velocityPxPerS?: number;
}): number {
  const { startPage, pageSize, pageCount } = opts;
  const invert = opts.invert ? -1 : 1;
  const signed = opts.delta * invert;
  const vel = (opts.velocityPxPerS ?? 0) * invert;
  if (!shouldCommitPageTurn(signed, pageSize, vel)) {
    return startPage;
  }
  const step = signed > 0 ? 1 : -1;
  return Math.min(Math.max(0, startPage + step), Math.max(0, pageCount - 1));
}
