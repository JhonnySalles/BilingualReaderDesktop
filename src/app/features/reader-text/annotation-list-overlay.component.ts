import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AnnotationFilters,
  AnnotationItem,
  AnnotationMarkFilter,
  BookAnnotation
} from '../../core/models';
import {
  buildRows,
  collectChapters,
  filterAnnotations
} from '../annotations/annotation-group.util';
import { AnnotationCardComponent } from '../annotations/components/annotation-card.component';
import { AnnotationFilterPopupComponent } from '../annotations/components/annotation-filter-popup.component';
import { AnnotationPopupComponent } from '../annotations/components/annotation-popup.component';

@Component({
  selector: 'app-annotation-list-overlay',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AnnotationCardComponent,
    AnnotationFilterPopupComponent,
    AnnotationPopupComponent
  ],
  template: `
    <div class="absolute inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-md"
      (click)="$event.stopPropagation()">
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0">
        <button type="button" (click)="close.emit()"
          class="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer" title="Fechar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <input
          type="search"
          class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="Buscar anotações…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)" />
        <button
          type="button"
          (click)="showFilters.set(true)"
          class="p-2 rounded-xl border transition-colors cursor-pointer"
          [class.border-indigo-500]="hasAdvanced()"
          [class.text-indigo-300]="hasAdvanced()"
          [class.border-slate-700]="!hasAdvanced()"
          [class.text-slate-300]="!hasAdvanced()"
          [class.hover:bg-slate-800]="!hasAdvanced()"
          title="Filtros">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-3">
        @if (rows().length === 0) {
          <p class="text-xs text-slate-500 py-10 text-center">
            Nenhuma anotação neste livro. Selecione um trecho para destacar.
          </p>
        } @else {
          <div class="flex flex-col max-w-3xl mx-auto">
            @for (row of rows(); track row.key) {
              @if (row.kind === 'chapter') {
                <div class="sticky top-0 z-[1] flex items-center justify-between gap-3
                  text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-slate-950/95 py-2 mt-1 first:mt-0 border-b border-slate-800">
                  <span class="truncate">{{ row.title }}</span>
                  <span class="text-slate-500 tabular-nums shrink-0">{{ row.count }}</span>
                </div>
              } @else if (row.kind === 'item') {
                <div class="py-1.5">
                  <app-annotation-card
                    [item]="row.item"
                    (open)="open.emit($event)"
                    (toggleFavorite)="toggleFavorite.emit($event)"
                    (editNote)="editing.set($event)"
                    (changeColor)="changeColor.emit($event)"
                    (remove)="remove.emit($event)" />
                </div>
              }
            }
          </div>
        }
      </div>

      @if (showFilters()) {
        <app-annotation-filter-popup
          [marks]="marks()"
          [colors]="colors()"
          [selectedChapters]="chapters()"
          [chapters]="availableChapters()"
          (close)="showFilters.set(false)"
          (applyFilters)="onApplyFilters($event)" />
      }

      @if (editing(); as draft) {
        <app-annotation-popup
          [annotation]="draft"
          (save)="onSaveNote($event)"
          (delete)="onDeleteNote()"
          (cancel)="editing.set(null)" />
      }
    </div>
  `
})
export class AnnotationListOverlayComponent implements OnChanges {
  @Input() annotations: BookAnnotation[] = [];
  @Input() bookId = 0;
  @Input() bookTitle = '';

  @Output() close = new EventEmitter<void>();
  @Output() open = new EventEmitter<AnnotationItem>();
  @Output() toggleFavorite = new EventEmitter<AnnotationItem>();
  @Output() changeColor = new EventEmitter<{ item: AnnotationItem; color: string }>();
  @Output() remove = new EventEmitter<AnnotationItem>();
  @Output() save = new EventEmitter<AnnotationItem>();

  readonly search = signal('');
  readonly marks = signal<AnnotationMarkFilter[]>([]);
  readonly colors = signal<string[]>([]);
  readonly chapters = signal<string[]>([]);
  readonly showFilters = signal(false);
  readonly editing = signal<AnnotationItem | null>(null);

  private readonly source = signal<AnnotationItem[]>([]);

  readonly availableChapters = computed(() => collectChapters(this.source()));

  readonly hasAdvanced = computed(
    () => this.marks().length > 0 || this.colors().length > 0 || this.chapters().length > 0
  );

  readonly filtered = computed(() => {
    const filters: AnnotationFilters = {
      search: this.search(),
      type: 'BOOK',
      marks: this.marks(),
      colors: this.colors(),
      chapters: this.chapters()
    };
    return filterAnnotations(this.source(), filters);
  });

  readonly rows = computed(() => buildRows(this.filtered(), { withRoot: false }));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['annotations'] || changes['bookId'] || changes['bookTitle']) {
      this.source.set(
        (this.annotations || []).map(a => ({
          ...a,
          type: 'BOOK' as const,
          parentTitle: this.bookTitle || '',
          parentFileName: ''
        }))
      );
    }
  }

  onApplyFilters(payload: {
    marks: AnnotationMarkFilter[];
    colors: string[];
    chapters: string[];
  }): void {
    this.marks.set(payload.marks);
    this.colors.set(payload.colors);
    this.chapters.set(payload.chapters);
  }

  onSaveNote(annotation: BookAnnotation): void {
    const current = this.editing();
    if (!current) return;
    this.editing.set(null);
    this.save.emit({
      ...current,
      ...annotation,
      type: 'BOOK',
      parentTitle: current.parentTitle,
      parentFileName: current.parentFileName
    });
  }

  onDeleteNote(): void {
    const current = this.editing();
    if (!current) return;
    this.editing.set(null);
    this.remove.emit(current);
  }
}
