import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga } from '../../../../../core/models';

@Component({
  selector: 'app-manga-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group bg-slate-800/40 backdrop-blur-md rounded-lg p-2.5 border border-slate-700/40 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4">
      
      <!-- Thumbnail & Title -->
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-10 h-14 bg-slate-900 rounded overflow-hidden flex-shrink-0 relative border border-slate-700/50">
          @if (manga.coverPath) {
            <img [src]="'local-cover:///' + manga.coverPath" [alt]="manga.title" class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full flex items-center justify-center text-slate-600 text-[10px] uppercase font-bold">
              {{ manga.fileType }}
            </div>
          }
        </div>

        <div class="min-w-0">
          <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-indigo-400 transition-colors" [title]="manga.title">
            {{ manga.title }}
          </h4>
          <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span class="px-1.5 py-0.2 rounded bg-slate-900/80 text-indigo-300 font-mono text-[10px] border border-slate-700/60 uppercase">
              {{ manga.fileType }}
            </span>
            @if (manga.author) {
              <span class="truncate">{{ manga.author }}</span>
            }
          </div>
        </div>
      </div>

      <!-- Reading Progress -->
      <div class="flex items-center gap-6 flex-shrink-0">
        <div class="w-32 hidden sm:block">
          <div class="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{{ manga.bookMark }}/{{ manga.pages }} págs</span>
            <span>{{ getProgressPercentage() }}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full" [style.width.%]="getProgressPercentage()"></div>
          </div>
        </div>

        <!-- Size & Actions -->
        <div class="text-right text-xs text-slate-400 w-16 font-mono">
          {{ formatSize(manga.fileSize) }}
        </div>
      </div>

    </div>
  `
})
export class MangaListItemComponent {
  @Input({ required: true }) manga!: Manga;

  getProgressPercentage(): number {
    if (!this.manga.pages || this.manga.pages <= 0) return 0;
    return Math.min(100, Math.round((this.manga.bookMark / this.manga.pages) * 100));
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
