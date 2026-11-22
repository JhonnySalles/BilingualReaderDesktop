import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-detail-action-bar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-2">
      <button type="button" (click)="favoriteToggle.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
        [ngClass]="favoriteBtnClass">
        {{ isFavorite ? ('detail.favorite' | translate) : ('detail.addFavorite' | translate) }}
      </button>

      <button type="button" (click)="markRead.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        {{ 'detail.markAsRead' | translate }}
      </button>

      <button type="button" (click)="clearProgress.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        {{ 'detail.clearProgress' | translate }}
      </button>

      <button type="button" (click)="bookmark.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        {{ 'detail.setBookmark' | translate }}
      </button>

      @if (showAddTag) {
        <button type="button" (click)="addTag.emit()"
          class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
          {{ 'detail.addTag' | translate }}
        </button>
      }

      <button type="button" (click)="vocabulary.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        {{ 'detail.vocabulary' | translate }}
      </button>

      <button type="button" (click)="importVocabulary.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer">
        {{ 'detail.importVocabulary' | translate }}
      </button>

      <button type="button" (click)="tracker.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        {{ 'detail.tracker' | translate }}
      </button>

      @if (showSyncFile) {
        <button type="button" (click)="syncFile.emit()"
          class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
          [title]="'detail.syncFileTitle' | translate">
          <svg class="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          {{ 'detail.syncFile' | translate }}
        </button>
      }

      <button type="button" (click)="deleteItem.emit()"
        class="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition-colors cursor-pointer">
        {{ 'common.delete' | translate }}
      </button>
    </div>
  `
})
export class DetailActionBarComponent {
  @Input() accent: 'primary' | 'indigo' | 'amber' | 'book' | 'manga' = 'primary';
  @Input() isFavorite = false;
  @Input() showAddTag = false;
  @Input() showSyncFile = false;

  @Output() favoriteToggle = new EventEmitter<void>();
  @Output() markRead = new EventEmitter<void>();
  @Output() clearProgress = new EventEmitter<void>();
  @Output() bookmark = new EventEmitter<void>();
  @Output() addTag = new EventEmitter<void>();
  @Output() vocabulary = new EventEmitter<void>();
  @Output() importVocabulary = new EventEmitter<void>();
  @Output() tracker = new EventEmitter<void>();
  @Output() syncFile = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<void>();

  get favoriteBtnClass(): string {
    if (this.isFavorite) {
      if (this.accent === 'amber' || this.accent === 'book') {
        return 'bg-book-600 text-white border-book-500';
      }
      if (this.accent === 'indigo' || this.accent === 'manga') {
        return 'bg-manga-600 text-white border-manga-500';
      }
      return 'bg-primary-600 text-white border-primary-500';
    }
    return 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800';
  }
}
