import { Injectable } from '@angular/core';

/**
 * Session-scoped unlocks for app-level book passwords.
 * Cleared when the app reloads; not persisted.
 */
@Injectable({ providedIn: 'root' })
export class BookUnlockService {
  private unlocked = new Set<number>();

  isUnlocked(bookId: number): boolean {
    return this.unlocked.has(bookId);
  }

  markUnlocked(bookId: number): void {
    if (bookId > 0) this.unlocked.add(bookId);
  }

  clear(bookId?: number): void {
    if (bookId != null) this.unlocked.delete(bookId);
    else this.unlocked.clear();
  }
}
