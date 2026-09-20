import { PageTransitionType } from '../../../core/models/enums/page-transition.enums';
import {
  cancelActivePageTurns,
  playFoldTurn,
  playPageTurn
} from './page-transition.player';

function makeEl(tag = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.style.width = '200px';
  el.style.height = '300px';
  document.body.appendChild(el);
  return el;
}

describe('page-transition.player', () => {
  afterEach(() => {
    cancelActivePageTurns();
    for (const el of Array.from(document.body.querySelectorAll('[data-pt-test]'))) {
      el.remove();
    }
  });

  function makeTestEl(): HTMLElement {
    const el = makeEl();
    el.setAttribute('data-pt-test', '1');
    return el;
  }

  it('runs commit before clearing inline styles', async () => {
    const outgoing = makeTestEl();
    const incoming = makeTestEl();
    const order: string[] = [];

    await playPageTurn({
      outgoing,
      incoming,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200,
      durationMs: 40,
      owner: 'test-commit',
      commit: () => {
        order.push('commit');
        expect(outgoing.style.opacity === '' ? 'cleared' : 'held').toBe('held');
      }
    });
    order.push('after');
    expect(order).toEqual(['commit', 'after']);
    expect(outgoing.style.opacity).toBe('');
    expect(incoming.style.opacity).toBe('');
  });

  it('cancelActivePageTurns(owner) only cancels that owner', async () => {
    const aOut = makeTestEl();
    const aIn = makeTestEl();
    const bOut = makeTestEl();
    const bIn = makeTestEl();

    const pA = playPageTurn({
      outgoing: aOut,
      incoming: aIn,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200,
      durationMs: 500,
      owner: 'owner-a'
    });
    const pB = playPageTurn({
      outgoing: bOut,
      incoming: bIn,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200,
      durationMs: 80,
      owner: 'owner-b'
    });

    // Cancel A mid-flight — must resolve promptly
    await new Promise(r => setTimeout(r, 20));
    cancelActivePageTurns('owner-a');
    await pA;
    await pB;
    expect(bOut.style.opacity).toBe('');
  });

  it('playPageTurn forces incoming visibility before animating', async () => {
    const outgoing = makeTestEl();
    const incoming = makeTestEl();
    incoming.style.visibility = 'hidden';

    await playPageTurn({
      outgoing,
      incoming,
      effect: PageTransitionType.Fade,
      axis: 'x',
      dir: 1,
      size: 200,
      durationMs: 40,
      owner: 'test-peek-visible',
      commit: () => {
        expect(incoming.style.visibility).toBe('visible');
      }
    });
  });

  it('playPageTurn mirror flips visual slide without swapping layers', async () => {
    const outgoing = makeTestEl();
    const incoming = makeTestEl();
    let endTransform = '';

    await playPageTurn({
      outgoing,
      incoming,
      effect: PageTransitionType.Default,
      axis: 'x',
      dir: 1,
      mirror: true,
      size: 200,
      durationMs: 40,
      owner: 'test-mirror',
      commit: () => {
        endTransform = outgoing.style.transform || '';
      }
    });

    // Logical next + mirror → visual prev: outgoing ends at +size
    expect(endTransform).toContain('200');
  });

  it('playFoldTurn restores underneath visibility/transform', async () => {
    const host = makeTestEl();
    host.style.position = 'relative';
    const underneath = makeTestEl();
    underneath.style.visibility = 'hidden';
    underneath.style.transform = 'translateX(50px)';
    host.appendChild(underneath);
    const el = makeTestEl();
    host.appendChild(el);

    await playFoldTurn({
      el,
      dir: 1,
      size: 200,
      durationMs: 40,
      underneath,
      owner: 'test-fold-restore'
    });

    expect(underneath.style.visibility).toBe('hidden');
    expect(underneath.style.transform).toBe('translateX(50px)');
  });
});
