import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectronService } from '../../../core/services/electron.service';
import { Vocabulary, VocabularyBook, VocabularyManga } from '../../../core/models';

@Component({
  selector: 'app-vocabulary-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="group flex gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900 px-3 py-3 transition-colors cursor-pointer"
      (click)="open.emit(item)"
      (contextmenu)="onContext($event)">
      <div class="shrink-0 w-10 flex items-start justify-center pt-0.5">
        <span class="text-xl font-bold text-indigo-200 leading-tight writing-vertical"
          [style.writing-mode]="'vertical-rl'"
          [style.text-orientation]="'upright'">
          {{ item.word }}
        </span>
      </div>

      <div class="flex-1 min-w-0 space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-xs text-slate-300 truncate">
              <span class="text-slate-100 font-medium">{{ item.reading || '—' }}</span>
              @if (!item.revised) {
                <span class="text-amber-400/90 ml-0.5" title="Não revisado">¹</span>
              }
              <span class="text-slate-500 ml-2">Freq. {{ item.appears || 0 }}</span>
            </p>
            @if (item.basicForm && item.basicForm !== item.word) {
              <p class="text-[11px] text-slate-500 truncate">Forma base: {{ item.basicForm }}</p>
            }
          </div>
          <button type="button"
            class="p-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
            [class.text-amber-400]="item.favorite"
            [class.text-slate-500]="!item.favorite"
            [class.hover:bg-slate-800]="true"
            (click)="onFavorite($event)"
            [title]="item.favorite ? 'Remover favorito' : 'Favoritar'">
            <svg class="w-4 h-4" [attr.fill]="item.favorite ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          </button>
        </div>

        <p class="text-sm text-slate-200 leading-snug line-clamp-2">{{ item.portuguese || '—' }}</p>
        @if (showEnglish && item.english) {
          <p class="text-[11px] text-slate-400 leading-snug line-clamp-2">{{ item.english }}</p>
        }

        @if (relatedMangas.length || relatedBooks.length) {
          <div class="flex gap-2 overflow-x-auto pt-1 pb-0.5 scrollbar-thin">
            @for (m of relatedMangas; track m.fkManga) {
              <div class="relative shrink-0 w-9 h-12 rounded-md overflow-hidden border border-slate-700 bg-slate-800"
                [title]="(m.title || '') + ' · ' + m.appears">
                @if (m.coverPath) {
                  <img [src]="'local-cover:///' + m.coverPath" alt="" class="w-full h-full object-cover" />
                }
                <span class="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/70 text-indigo-200">{{ m.appears }}</span>
              </div>
            }
            @for (b of relatedBooks; track b.fkBook) {
              <div class="relative shrink-0 w-9 h-12 rounded-md overflow-hidden border border-amber-900/50 bg-slate-800"
                [title]="(b.title || '') + ' · ' + b.appears">
                @if (b.coverPath) {
                  <img [src]="'local-cover:///' + b.coverPath" alt="" class="w-full h-full object-cover" />
                }
                <span class="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/70 text-amber-200">{{ b.appears }}</span>
              </div>
            }
          </div>
        }

        @if (showGlobalActions) {
          <div class="flex flex-wrap gap-1.5 pt-0.5" (click)="$event.stopPropagation()">
            <button type="button" (click)="filterManga.emit(item)"
              class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-900/60 cursor-pointer">
              Mangás
            </button>
            <button type="button" (click)="filterBook.emit(item)"
              class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/40 cursor-pointer">
              Livros
            </button>
          </div>
        }
      </div>
    </article>
  `
})
export class VocabularyCardComponent {
  private electron = inject(ElectronService);

  @Input({ required: true }) item!: Vocabulary;
  @Input() showEnglish = true;
  @Input() showGlobalActions = true;
  @Input() relatedMangas: VocabularyManga[] = [];
  @Input() relatedBooks: VocabularyBook[] = [];

  @Output() open = new EventEmitter<Vocabulary>();
  @Output() favoriteChanged = new EventEmitter<Vocabulary>();
  @Output() filterManga = new EventEmitter<Vocabulary>();
  @Output() filterBook = new EventEmitter<Vocabulary>();

  async onFavorite(ev: Event): Promise<void> {
    ev.stopPropagation();
    if (!this.item.id) return;
    const next = !this.item.favorite;
    const updated = await this.electron.setVocabularyFavorite(this.item.id, next);
    if (updated) {
      this.item = { ...this.item, favorite: updated.favorite };
      this.favoriteChanged.emit(this.item);
    }
  }

  onContext(ev: MouseEvent): void {
    ev.preventDefault();
    const text = `${this.item.word}\t${this.item.portuguese || ''}`.trim();
    void navigator.clipboard?.writeText(text);
  }
}
