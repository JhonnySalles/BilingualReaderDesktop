import { Injectable, signal, computed } from '@angular/core';
import { AnnotationContentType, AnnotationMarkFilter } from '../models';

@Injectable({ providedIn: 'root' })
export class AnnotationsUiStateService {
  readonly search = signal('');
  /** null = Todos */
  readonly type = signal<AnnotationContentType | null>(null);
  readonly marks = signal<AnnotationMarkFilter[]>([]);
  readonly colors = signal<string[]>([]);
  readonly chapters = signal<string[]>([]);
  readonly availableChapters = signal<string[]>([]);
  readonly showFilterPopup = signal(false);
  readonly reloadToken = signal(0);

  readonly pageTitle = computed(() => {
    const t = this.type();
    if (t === 'BOOK') return 'Anotações — Livros';
    if (t === 'MANGA') return 'Anotações — Mangás';
    return 'Anotações';
  });

  readonly hasAdvancedFilters = computed(
    () => this.marks().length > 0 || this.colors().length > 0 || this.chapters().length > 0
  );

  setSearch(value: string): void {
    this.search.set(value);
  }

  setType(type: AnnotationContentType | null): void {
    if (this.type() === type) return;
    this.type.set(type);
  }

  setAdvancedFilters(payload: {
    marks: AnnotationMarkFilter[];
    colors: string[];
    chapters: string[];
  }): void {
    this.marks.set(payload.marks);
    this.colors.set(payload.colors);
    this.chapters.set(payload.chapters);
  }

  clearAdvancedFilters(): void {
    this.marks.set([]);
    this.colors.set([]);
    this.chapters.set([]);
  }

  bumpReload(): void {
    this.reloadToken.update(v => v + 1);
  }
}
