/** App-level book lock helpers (plaintext Book.password, Android parity). */

export function bookNeedsUnlock(password: string | null | undefined): boolean {
  return String(password ?? '').length > 0;
}

export function bookPasswordMatches(
  stored: string | null | undefined,
  attempt: string | null | undefined
): boolean {
  return String(stored ?? '') === String(attempt ?? '');
}

export function normalizeBookPassword(value: string | null | undefined): string {
  return String(value ?? '');
}
