import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DetailBookmarkItem {
  id?: number;
  page: number;
  pages?: number;
  note?: string;
  chapter?: string;
  type?: string;
  dateCreate?: string;
  color?: string;
}

@Component({
  selector: 'app-detail-bookmarks-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-3">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Marcadores & Anotações ({{ bookmarks.length }})
        </h3>
        @if (showAddButton) {
          <button
            type="button"
            (click)="addBookmark.emit()"
            class="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
            + Novo Marcador
          </button>
        }
      </div>

      @if (bookmarks.length === 0) {
        <p class="text-xs text-slate-500 py-2">Nenhum marcador adicionado.</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
          @for (bm of bookmarks; track bm.id || bm.page) {
            <div
              class="group flex items-start justify-between gap-2 p-3 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-all">
              <button
                type="button"
                (click)="select.emit(bm)"
                class="flex-1 text-left cursor-pointer min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60 tabular-nums">
                    Pág. {{ bm.page }}
                  </span>
                  @if (bm.chapter) {
                    <span class="text-[11px] text-slate-400 truncate max-w-[140px]">{{ bm.chapter }}</span>
                  }
                </div>
                @if (bm.note) {
                  <p class="text-xs text-slate-200 line-clamp-2 italic">{{ bm.note }}</p>
                }
              </button>

              @if (bm.id) {
                <button
                  type="button"
                  (click)="delete.emit(bm)"
                  title="Excluir marcador"
                  class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              }
            </div>
          }
        </div>
      }
    </section>
  `
})
export class DetailBookmarksListComponent {
  @Input() bookmarks: DetailBookmarkItem[] = [];
  @Input() showAddButton = false;

  @Output() select = new EventEmitter<DetailBookmarkItem>();
  @Output() delete = new EventEmitter<DetailBookmarkItem>();
  @Output() addBookmark = new EventEmitter<void>();
}
