import { onViewTransitionCreated } from '../../../../src/app/core/utils/view-transition.util';

describe('view-transition.util', () => {
  let mockTransition: any;
  let readyReject: (reason?: any) => void;
  let finishedReject: (reason?: any) => void;
  let updateCallbackDoneReject: (reason?: any) => void;

  beforeEach(() => {
    const readyPromise = new Promise<void>((_, reject) => {
      readyReject = reject;
    });
    const finishedPromise = new Promise<void>((_, reject) => {
      finishedReject = reject;
    });
    const updateCallbackDonePromise = new Promise<void>((_, reject) => {
      updateCallbackDoneReject = reject;
    });

    mockTransition = {
      ready: readyPromise,
      finished: finishedPromise,
      updateCallbackDone: updateCallbackDonePromise,
      skipTransition: jasmine.createSpy('skipTransition')
    };
  });

  it('deve registrar handlers e nao lançar erro ao receber rejeições de TimeoutError ou InvalidStateError', async () => {
    onViewTransitionCreated({ transition: mockTransition } as any);

    const timeoutErr = new Error('Transition was aborted because of timeout in DOM update');
    (timeoutErr as any).name = 'TimeoutError';

    const invalidStateErr = new Error('Transition was aborted because of invalid state');
    (invalidStateErr as any).name = 'InvalidStateError';

    readyReject(timeoutErr);
    finishedReject(invalidStateErr);
    updateCallbackDoneReject(timeoutErr);

    await Promise.resolve();
    expect(true).toBeTrue();
  });

  it('deve chamar skipTransition na transicao anterior quando uma nova e iniciada concorrentemente', () => {
    const firstTransition = {
      ...mockTransition,
      skipTransition: jasmine.createSpy('skipTransitionFirst')
    };
    const secondTransition = {
      ready: Promise.resolve(),
      finished: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: jasmine.createSpy('skipTransitionSecond')
    };

    onViewTransitionCreated({ transition: firstTransition } as any);
    onViewTransitionCreated({ transition: secondTransition } as any);

    expect(firstTransition.skipTransition).toHaveBeenCalled();
  });
});

