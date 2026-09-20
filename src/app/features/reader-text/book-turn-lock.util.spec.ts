import { isBookNavLocked } from './book-turn-lock.util';

describe('isBookNavLocked', () => {
  it('allows nav when idle', () => {
    expect(isBookNavLocked(false, false)).toBeFalse();
  });

  it('blocks nav while turningPage', () => {
    expect(isBookNavLocked(true, false)).toBeTrue();
  });

  it('blocks nav while driverActive', () => {
    expect(isBookNavLocked(false, true)).toBeTrue();
  });

  it('blocks nav when both busy', () => {
    expect(isBookNavLocked(true, true)).toBeTrue();
  });
});
