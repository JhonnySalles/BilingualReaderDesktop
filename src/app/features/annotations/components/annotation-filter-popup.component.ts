import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ANNOTATION_COLOR_OPTIONS,
  ANNOTATION_MARK_OPTIONS,
  AnnotationMarkFilter
} from '../../../core/models';

@Component({
  selector: 'app-annotation-filter-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[min(90vh,32rem)]"
        (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h3 class="text-sm font-bold text-slate-100">Filtros de anotações</h3>
          <button type="button" (click)="close.emit()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer" title="Fechar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="flex border-b border-slate-800 shrink-0">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="flex-1 px-3 py-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2"
              [class.border-indigo-500]="activeTab() === tab.id"
              [class.text-indigo-300]="activeTab() === tab.id"
              [class.border-transparent]="activeTab() !== tab.id"
              [class.text-slate-400]="activeTab() !== tab.id"
              [class.hover:text-slate-200]="activeTab() !== tab.id"
              (click)="activeTab.set(tab.id)">
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          @if (activeTab() === 'type') {
            <div class="space-y-3">
              @for (opt of markOptions; track opt.value) {
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [checked]="localMarks().includes(opt.value)"
                    (change)="toggleMark(opt.value)" />
                  <span class="text-sm text-slate-200 group-hover:text-white">{{ opt.label }}</span>
                </label>
              }
            </div>
          }

          @if (activeTab() === 'color') {
            <div class="space-y-3">
              @for (opt of colorOptions; track opt.value) {
                <label class="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-indigo-600 rounded"
                    [checked]="localColors().includes(opt.value)"
                    (change)="toggleColor(opt.value)" />
                  <span
                    class="w-4 h-4 rounded-full border border-slate-600 shrink-0"
                    [style.backgroundColor]="opt.hex || 'transparent'"
                    [class.bg-slate-800]="!opt.hex"></span>
                  <span class="text-sm text-slate-200 group-hover:text-white">{{ opt.label }}</span>
                </label>
              }
            </div>
          }

          @if (activeTab() === 'chapter') {
            @if (chapters.length === 0) {
              <p class="text-xs text-slate-500 text-center py-6">Nenhum capítulo disponível</p>
            } @else {
              <div class="space-y-2">
                @for (ch of chapters; track ch) {
                  <label class="flex items-center gap-3 cursor-pointer group px-1 py-1 rounded-lg hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      class="w-4 h-4 accent-indigo-600 rounded"
                      [checked]="localChapters().includes(ch)"
                      (change)="toggleChapter(ch)" />
                    <span class="text-sm text-slate-200 group-hover:text-white truncate">{{ ch }}</span>
                  </label>
                }
              </div>
            }
          }
        </div>

        <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            class="text-xs font-semibold text-slate-400 hover:text-rose-300 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-800"
            (click)="clearAll()">
            Limpar filtros
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            (click)="apply()">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  `
})
export class AnnotationFilterPopupComponent implements OnChanges {
  @Input() marks: AnnotationMarkFilter[] = [];
  @Input() colors: string[] = [];
  @Input() selectedChapters: string[] = [];
  @Input() chapters: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<{
    marks: AnnotationMarkFilter[];
    colors: string[];
    chapters: string[];
  }>();

  readonly tabs = [
    { id: 'type' as const, label: 'Tipo' },
    { id: 'color' as const, label: 'Cor' },
    { id: 'chapter' as const, label: 'Capítulos' }
  ];
  readonly markOptions = ANNOTATION_MARK_OPTIONS;
  readonly colorOptions = ANNOTATION_COLOR_OPTIONS;

  activeTab = signal<'type' | 'color' | 'chapter'>('type');
  localMarks = signal<AnnotationMarkFilter[]>([]);
  localColors = signal<string[]>([]);
  localChapters = signal<string[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['marks']) this.localMarks.set([...this.marks]);
    if (changes['colors']) this.localColors.set([...this.colors]);
    if (changes['selectedChapters']) this.localChapters.set([...this.selectedChapters]);
  }

  toggleMark(value: AnnotationMarkFilter): void {
    this.localMarks.update(list =>
      list.includes(value) ? list.filter(m => m !== value) : [...list, value]
    );
  }

  toggleColor(value: string): void {
    this.localColors.update(list =>
      list.includes(value) ? list.filter(c => c !== value) : [...list, value]
    );
  }

  toggleChapter(value: string): void {
    this.localChapters.update(list =>
      list.includes(value) ? list.filter(c => c !== value) : [...list, value]
    );
  }

  clearAll(): void {
    this.localMarks.set([]);
    this.localColors.set([]);
    this.localChapters.set([]);
  }

  apply(): void {
    this.applyFilters.emit({
      marks: [...this.localMarks()],
      colors: [...this.localColors()],
      chapters: [...this.localChapters()]
    });
    this.close.emit();
  }
}
