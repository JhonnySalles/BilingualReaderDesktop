import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-action-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap gap-2">
      <button type="button" (click)="favoriteToggle.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
        [ngClass]="favoriteBtnClass">
        {{ isFavorite ? 'Favorito' : 'Favoritar' }}
      </button>

      <button type="button" (click)="markRead.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        Marcar como lido
      </button>

      <button type="button" (click)="clearProgress.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        Limpar progresso
      </button>

      <button type="button" (click)="bookmark.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        Definir bookmark
      </button>

      @if (showAddTag) {
        <button type="button" (click)="addTag.emit()"
          class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
          Adicionar tag
        </button>
      }

      <button type="button" (click)="vocabulary.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        Vocabulário
      </button>

      <button type="button" (click)="deleteItem.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition-colors cursor-pointer">
        Excluir
      </button>
    </div>
  `
})
export class DetailActionBarComponent {
  @Input() accent: 'indigo' | 'amber' = 'indigo';
  @Input() isFavorite = false;
  @Input() showAddTag = false;

  @Output() favoriteToggle = new EventEmitter<void>();
  @Output() markRead = new EventEmitter<void>();
  @Output() clearProgress = new EventEmitter<void>();
  @Output() bookmark = new EventEmitter<void>();
  @Output() addTag = new EventEmitter<void>();
  @Output() vocabulary = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<void>();

  get favoriteBtnClass(): string {
    if (this.isFavorite) {
      return this.accent === 'indigo'
        ? 'bg-indigo-600 text-white border-indigo-500'
        : 'bg-amber-600 text-white border-amber-500';
    }
    return 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800';
  }
}
