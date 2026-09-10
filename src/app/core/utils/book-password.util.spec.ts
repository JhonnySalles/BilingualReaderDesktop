import {
  bookNeedsUnlock,
  bookPasswordMatches,
  normalizeBookPassword
} from './book-password.util';

describe('book-password.util', () => {
  it('detects when unlock is required', () => {
    expect(bookNeedsUnlock('')).toBeFalse();
    expect(bookNeedsUnlock(null)).toBeFalse();
    expect(bookNeedsUnlock('secret')).toBeTrue();
  });

  it('compares passwords exactly', () => {
    expect(bookPasswordMatches('abc', 'abc')).toBeTrue();
    expect(bookPasswordMatches('abc', 'ABC')).toBeFalse();
    expect(bookPasswordMatches('', '')).toBeTrue();
  });

  it('normalizes nullish to empty string', () => {
    expect(normalizeBookPassword(null)).toBe('');
    expect(normalizeBookPassword(undefined)).toBe('');
    expect(normalizeBookPassword('x')).toBe('x');
  });
});
