import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DetailChapterItem {
  index: number;
  label: string;
  page?: number;
  href?: string;
}

@Component({
  selector: 'app-detail-chapters-list',
  standalone: true,
  imports: [CommonModule],
  host: {
    class: 'block'
  },
  template: `
    <section class="space-y-3">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
        Capítulos
      </h3>
      @if (chapters.length === 0) {
        <p class="text-xs text-slate-500">Nenhum capítulo detectado.</p>
      } @else {
        <div class="space-y-1 max-h-72 overflow-y-auto pr-1">
          @for (ch of chapters; track ch.index) {
            <button
              type="button"
              (click)="select.emit(ch)"
              class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
              [ngClass]="accent === 'amber' ? 'hover:border-amber-500' : 'hover:border-indigo-500'">
              <span class="text-slate-200 truncate">{{ ch.label }}</span>
              @if (ch.page != null && ch.page >= 0) {
                <span class="text-slate-500 tabular-nums shrink-0">pág. {{ ch.page + 1 }}</span>
              }
            </button>
          }
        </div>
      }
    </section>
  `
})
export class DetailChaptersListComponent {
  @Input() chapters: DetailChapterItem[] = [];
  @Input() accent: 'indigo' | 'amber' = 'indigo';
  @Output() select = new EventEmitter<DetailChapterItem>();
}
