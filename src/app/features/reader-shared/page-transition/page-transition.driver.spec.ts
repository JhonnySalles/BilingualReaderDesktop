import { PageTransitionType } from '../../../core/models/enums/page-transition.enums';
import { PageTurnDriver } from './page-transition.driver';
import {
  curlFoldingLeaf,
  progressToCurlPosition,
  progressToTurnPosition
} from './page-curl.canvas';
import { cancelActivePageTurns, playFoldTurn, playPageTurn } from './page-transition.player';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-pt-test', '1');
  el.style.width = '200px';
  el.style.height = '300px';
  document.body.appendChild(el);
  return el;
}

describe('PageTurnDriver', () => {
  afterEach(() => {
    for (const el of Array.from(document.body.querySelectorAll('[data-pt-test]'))) {
      el.remove();
    }
  });

  it('setPosition applies styles without animating', () => {
    const outgoing = makeEl();
    const incoming = makeEl();
    const driver = new PageTurnDriver({
      outgoing,
      incoming,
      effect: PageTransitionType.Default,
      axis: 'x',
      dir: 1,
      size: 200,
      variant: 'manga'
    });
    driver.setPosition(-0.5);
    expect(driver.getPosition()).toBe(-0.5);
    expect(outgoing.style.transform).toContain('translateX(-100px)');
    expect(incoming.style.transform).toContain('translateX(100px)');
    driver.release();
    expect(outgoing.style.transform).toBe('');
  });

  it('animateTo continues from current position and runs commit before release', async () => {
    const outgoing = makeEl();
    const incoming = makeEl();
    const driver = new PageTurnDriver({
      outgoing,
      incoming,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200
    });
    driver.setPosition(-0.4);
    const order: string[] = [];
    await driver.animateTo(-1, 40, () => {
      order.push('commit');
      expect(outgoing.style.opacity === '' ? 'cleared' : 'held').toBe('held');
    });
    order.push('after');
    expect(order).toEqual(['commit', 'after']);
    expect(outgoing.style.opacity).toBe('');
  });

  it('keeps zIndex constant during setPosition scrub', () => {
    const outgoing = makeEl();
    const incoming = makeEl();
    const driver = new PageTurnDriver({
      outgoing,
      incoming,
      effect: PageTransitionType.Depth,
      axis: 'x',
      dir: 1,
      size: 200
    });
    driver.setPosition(-0.1);
    const z0 = outgoing.style.zIndex;
    driver.setPosition(-0.5);
    expect(outgoing.style.zIndex).toBe(z0);
    driver.release();
  });
});

describe('curl folding leaf mapping', () => {
  it('next folds outgoing; prev folds incoming', () => {
    expect(curlFoldingLeaf(1)).toBe('outgoing');
    expect(curlFoldingLeaf(-1)).toBe('incoming');
  });

  it('verso of the fold is the opposite leaf (under), not the folding leaf', () => {
    // Documented contract used by manga-page-turn-layer paintCurlAtProgress:
    // backBmp === underBmp !== foldBmp (when pages differ)
    const nextLeaf = curlFoldingLeaf(1);
    const nextUnder = nextLeaf === 'outgoing' ? 'incoming' : 'outgoing';
    expect(nextLeaf).toBe('outgoing');
    expect(nextUnder).toBe('incoming');

    const prevLeaf = curlFoldingLeaf(-1);
    const prevUnder = prevLeaf === 'outgoing' ? 'incoming' : 'outgoing';
    expect(prevLeaf).toBe('incoming');
    expect(prevUnder).toBe('outgoing');
  });

  it('progressToCurlPosition maps next 0→-1 and prev -1→0', () => {
    expect(progressToCurlPosition(0, 1)).toBe(0);
    expect(progressToCurlPosition(1, 1)).toBe(-1);
    expect(progressToCurlPosition(0, -1)).toBe(-1);
    expect(progressToCurlPosition(1, -1)).toBe(0);
  });

  it('progressToTurnPosition maps next 0→-1 and prev 0→+1', () => {
    expect(progressToTurnPosition(0, 1)).toBe(0);
    expect(progressToTurnPosition(1, 1)).toBe(-1);
    expect(progressToTurnPosition(0, -1)).toBe(0);
    expect(progressToTurnPosition(1, -1)).toBe(1);
  });
});

describe('playFoldTurn underneath restore', () => {
  afterEach(() => {
    cancelActivePageTurns();
    for (const el of Array.from(document.body.querySelectorAll('[data-pt-test]'))) {
      el.remove();
    }
  });

  it('restores underneath visibility and transform after fold', async () => {
    const host = makeEl();
    host.style.position = 'relative';
    const underneath = makeEl();
    underneath.style.visibility = 'hidden';
    underneath.style.transform = 'translateX(100px)';
    host.appendChild(underneath);
    const el = makeEl();
    host.appendChild(el);

    await playFoldTurn({
      el,
      dir: 1,
      size: 200,
      durationMs: 40,
      underneath,
      owner: 'test-fold'
    });

    expect(underneath.style.visibility).toBe('hidden');
    expect(underneath.style.transform).toBe('translateX(100px)');
  });
});

describe('playPageTurn via driver', () => {
  afterEach(() => {
    cancelActivePageTurns();
    for (const el of Array.from(document.body.querySelectorAll('[data-pt-test]'))) {
      el.remove();
    }
  });

  it('runs commit before clearing styles', async () => {
    const outgoing = makeEl();
    const incoming = makeEl();
    const order: string[] = [];
    await playPageTurn({
      outgoing,
      incoming,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200,
      durationMs: 40,
      owner: 'test-play',
      commit: () => {
        order.push('commit');
      }
    });
    order.push('after');
    expect(order).toEqual(['commit', 'after']);
  });
});
