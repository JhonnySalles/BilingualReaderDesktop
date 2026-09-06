import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectronService } from '../../core/services/electron.service';
import { AnnotationsUiStateService } from '../../core/services/annotations-ui-state.service';
import {
  AnnotationFilters,
  AnnotationItem,
  BookAnnotation
} from '../../core/models';
import {
  buildRows,
  collectChapters,
  filterAnnotations,
  sortAnnotationItems,
  toAnnotationItemsFromBooks,
  toAnnotationItemsFromMangas
} from './annotation-group.util';
import { AnnotationCardComponent } from './components/annotation-card.component';
import { AnnotationFilterPopupComponent } from './components/annotation-filter-popup.component';
import { AnnotationPopupComponent } from './components/annotation-popup.component';

@Component({
  selector: 'app-annotations',
  standalone: true,
  imports: [
    CommonModule,
    AnnotationCardComponent,
    AnnotationFilterPopupComponent,
    AnnotationPopupComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      @if (ui.showFilterPopup()) {
        <app-annotation-filter-popup
          [marks]="ui.marks()"
          [colors]="ui.colors()"
          [selectedChapters]="ui.chapters()"
          [chapters]="ui.availableChapters()"
          (close)="ui.showFilterPopup.set(false)"
          (applyFilters)="onApplyFilters($event)" />
      }

      @if (editing(); as draft) {
        <app-annotation-popup
          [annotation]="draft"
          (save)="onSaveNote($event)"
          (delete)="onDeleteFromPopup()"
          (cancel)="editing.set(null)" />
      }

      <div class="flex-1 min-h-0 overflow-y-auto p-6">
        @if (loading()) {
          <p class="text-xs text-slate-500 text-center py-16">Carregando anotações…</p>
        } @else if (rows().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 text-center px-6">
            <div class="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-indigo-400">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H7z"/>
              </svg>
            </div>
            <p class="text-sm font-semibold text-slate-200">Nenhuma anotação encontrada</p>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              Destaque trechos nos livros ou marque páginas em livros e mangás para vê-los aqui.
            </p>
          </div>
        } @else {
          <div class="space-y-1 max-w-3xl mx-auto">
            @for (row of rows(); track row.key) {
              @if (row.kind === 'root') {
                <div class="mt-6 first:mt-0 mb-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 px-4 py-3">
                  <p class="text-sm font-bold text-slate-100 truncate">{{ row.title }}</p>
                  @if (row.subtitle) {
                    <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ row.subtitle }}</p>
                  }
                </div>
              } @else if (row.kind === 'chapter') {
                <div class="sticky top-0 z-10 flex items-center justify-between gap-3 py-2 px-1
                  bg-slate-950/90 backdrop-blur border-b border-slate-800 mt-4 first:mt-0">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-400 truncate">
                    {{ row.title }}
                  </span>
                  <span class="text-[10px] font-semibold text-slate-500 tabular-nums shrink-0">
                    {{ row.count }}
                  </span>
                </div>
              } @else {
                <div class="py-1.5">
                  <app-annotation-card
                    [item]="row.item"
                    (open)="onOpen($event)"
                    (toggleFavorite)="onToggleFavorite($event)"
                    (editNote)="editing.set($event)"
                    (changeColor)="onChangeColor($event)"
                    (remove)="onRemove($event)" />
                </div>
              }
            }
          </div>
        }
      </div>
    </div>
  `
})
export class AnnotationsComponent {
  private electron = inject(ElectronService);
  private router = inject(Router);
  ui = inject(AnnotationsUiStateService);

  readonly loading = signal(false);
  readonly items = signal<AnnotationItem[]>([]);
  readonly editing = signal<AnnotationItem | null>(null);

  readonly filtered = computed(() => {
    const filters: AnnotationFilters = {
      search: this.ui.search(),
      type: this.ui.type(),
      marks: this.ui.marks(),
      colors: this.ui.colors(),
      chapters: this.ui.chapters()
    };
    return filterAnnotations(this.items(), filters);
  });

  readonly rows = computed(() => buildRows(this.filtered(), { withRoot: true }));

  constructor() {
    effect(() => {
      this.ui.reloadToken();
      void this.reload();
    });
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [booksRaw, mangasRaw] = await Promise.all([
        this.electron.listAllBookAnnotations(),
        this.electron.listAllMangaAnnotations()
      ]);
      const mapped = sortAnnotationItems([
        ...toAnnotationItemsFromBooks(booksRaw || []),
        ...toAnnotationItemsFromMangas(mangasRaw || [])
      ]);
      this.items.set(mapped);
      this.ui.availableChapters.set(collectChapters(mapped));
    } catch (e) {
      console.error('Failed to load annotations', e);
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  onApplyFilters(payload: {
    marks: import('../../core/models').AnnotationMarkFilter[];
    colors: string[];
    chapters: string[];
  }): void {
    this.ui.setAdvancedFilters(payload);
  }

  onOpen(item: AnnotationItem): void {
    if (item.type === 'MANGA') {
      void this.router.navigate(['/reader-image', item.fkBook], {
        queryParams: { page: item.page }
      });
      return;
    }
    void this.router.navigate(['/reader-text', item.fkBook], {
      queryParams: { page: item.page, cfi: item.cfiRange || undefined }
    });
  }

  async onToggleFavorite(item: AnnotationItem): Promise<void> {
    if (item.type === 'MANGA') return;
    const updated = await this.electron.saveBookAnnotation({
      ...item,
      favorite: !item.favorite
    });
    if (!updated) return;
    this.patchItem({
      ...item,
      ...updated,
      type: item.type,
      parentTitle: item.parentTitle,
      parentFileName: item.parentFileName
    });
  }

  async onChangeColor(ev: { item: AnnotationItem; color: string }): Promise<void> {
    if (ev.item.type === 'MANGA') return;
    const updated = await this.electron.saveBookAnnotation({
      ...ev.item,
      color: ev.color
    });
    if (!updated) return;
    this.patchItem({
      ...ev.item,
      ...updated,
      type: ev.item.type,
      parentTitle: ev.item.parentTitle,
      parentFileName: ev.item.parentFileName
    });
  }

  async onSaveNote(annotation: BookAnnotation): Promise<void> {
    const current = this.editing();
    if (!current) return;

    if (current.type === 'MANGA') {
      const updated = await this.electron.saveMangaAnnotation({
        id: current.id,
        fkManga: current.fkBook,
        page: current.page,
        pages: current.pages,
        markType: current.markType || 'PageMark',
        chapter: current.chapter || '',
        folder: '',
        note: annotation.note || ''
      });
      this.editing.set(null);
      if (!updated) return;
      this.patchItem({
        ...current,
        note: updated.note || '',
        alteration: updated.alteration
      });
      return;
    }

    const updated = await this.electron.saveBookAnnotation({
      ...current,
      ...annotation
    });
    this.editing.set(null);
    if (!updated) return;
    this.patchItem({
      ...current,
      ...updated,
      type: current.type,
      parentTitle: current.parentTitle,
      parentFileName: current.parentFileName
    });
  }

  async onDeleteFromPopup(): Promise<void> {
    const current = this.editing();
    if (!current?.id) return;
    this.editing.set(null);
    await this.onRemove(current);
  }

  async onRemove(item: AnnotationItem): Promise<void> {
    if (!item.id) return;
    const ok =
      item.type === 'MANGA'
        ? await this.electron.deleteMangaAnnotation(item.id)
        : await this.electron.deleteBookAnnotation(item.id);
    if (!ok) return;
    this.items.update(list =>
      list.filter(a => !(a.id === item.id && a.type === item.type))
    );
    this.ui.availableChapters.set(collectChapters(this.items()));
  }

  private patchItem(item: AnnotationItem): void {
    this.items.update(list =>
      list.map(a => (a.id === item.id && a.type === item.type ? item : a))
    );
  }
}
