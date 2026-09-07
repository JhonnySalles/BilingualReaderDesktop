import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Manga } from '../../../core/models';

@Component({
  selector: 'app-manga-file-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="absolute inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-md"
      (click)="$event.stopPropagation()">
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0">
        <button type="button" (click)="close.emit()"
          class="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer" title="Voltar">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <input
          type="search"
          class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          placeholder="Buscar mangá na biblioteca…"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          autofocus />
      </div>

      <div class="flex-1 overflow-y-auto p-3">
        @if (loading) {
          <p class="text-xs text-slate-400 py-10 text-center">Carregando biblioteca…</p>
        } @else if (filtered().length === 0) {
          <p class="text-xs text-slate-500 py-10 text-center">Nenhum mangá encontrado</p>
        } @else {
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            @for (m of filtered(); track m.id) {
              <button
                type="button"
                (click)="select.emit(m)"
                class="group text-left rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500/40 cursor-pointer transition-all">
                <div class="aspect-[2/3] bg-slate-950 relative">
                  @if (coverUrl(m)) {
                    <img [src]="coverUrl(m)" [alt]="m.title" class="w-full h-full object-cover" loading="lazy" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-[10px] text-slate-600 p-2 text-center">
                      Sem capa
                    </div>
                  }
                </div>
                <div class="p-2">
                  <p class="text-[11px] font-semibold text-slate-200 truncate group-hover:text-white">{{ m.title || m.name }}</p>
                  <p class="text-[10px] text-slate-500 truncate">{{ m.pages }} pág.</p>
                </div>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class MangaFilePickerComponent implements OnChanges {
  @Input() mangas: Manga[] = [];
  @Input() loading = false;
  @Input() excludePath = '';

  @Output() close = new EventEmitter<void>();
  @Output() select = new EventEmitter<Manga>();

  query = signal('');

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const exclude = (this.excludePath || '').toLowerCase();
    return this.mangas.filter(m => {
      if (exclude && (m.path || '').toLowerCase() === exclude) return false;
      if (!q) return true;
      const title = (m.title || '').toLowerCase();
      const name = (m.name || '').toLowerCase();
      const series = (m.series || '').toLowerCase();
      return title.includes(q) || name.includes(q) || series.includes(q);
    });
  });

  ngOnChanges(_changes: SimpleChanges): void {
    // trigger computed via input bindings
  }

  coverUrl(m: Manga): string {
    if (!m.coverPath) return '';
    const normalized = m.coverPath.replace(/\\/g, '/');
    return 'local-cover:///' + normalized;
  }
}
