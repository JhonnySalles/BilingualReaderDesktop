import { Injectable, signal, computed } from '@angular/core';
import { VocabularySortOrder } from '../models';

@Injectable({ providedIn: 'root' })
export class VocabularyUiStateService {
  readonly search = signal('');
  readonly favoriteOnly = signal(false);
  readonly order = signal<VocabularySortOrder>('word');
  readonly desc = signal(false);
  readonly showOrderPopup = signal(false);
  readonly reloadToken = signal(0);

  /** Scoped title context from query params. */
  readonly mangaId = signal<number | null>(null);
  readonly bookId = signal<number | null>(null);
  readonly scopeTitle = signal<string | null>(null);

  readonly pageTitle = computed(() => {
    const title = this.scopeTitle();
    if (this.mangaId() != null) return title ? `Vocabulário — ${title}` : 'Vocabulário — Mangá';
    if (this.bookId() != null) return title ? `Vocabulário — ${title}` : 'Vocabulário — Livro';
    return 'Vocabulário';
  });

  readonly isScoped = computed(() => this.mangaId() != null || this.bookId() != null);

  setSearch(value: string): void {
    this.search.set(value);
  }

  toggleFavoriteOnly(): void {
    this.favoriteOnly.update(v => !v);
  }

  cycleOrder(): void {
    const cur = this.order();
    if (cur === 'word') {
      this.order.set('appears');
      this.desc.set(true);
    } else if (cur === 'appears') {
      this.order.set('favorite');
      this.desc.set(false);
    } else {
      this.order.set('word');
      this.desc.set(false);
    }
  }

  setOrder(order: VocabularySortOrder, desc?: boolean): void {
    this.order.set(order);
    if (desc != null) this.desc.set(desc);
    else if (order === 'appears') this.desc.set(true);
    else this.desc.set(false);
  }

  setScope(opts: {
    mangaId?: number | null;
    bookId?: number | null;
    title?: string | null;
  }): void {
    this.mangaId.set(opts.mangaId ?? null);
    this.bookId.set(opts.bookId ?? null);
    this.scopeTitle.set(opts.title ?? null);
  }

  clearScope(): void {
    this.mangaId.set(null);
    this.bookId.set(null);
    this.scopeTitle.set(null);
  }

  bumpReload(): void {
    this.reloadToken.update(v => v + 1);
  }
}
