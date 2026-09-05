import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Book } from '../../../../core/models';

@Component({
  selector: 'app-book-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group relative bg-slate-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer flex flex-col h-full">
      
      <!-- Cover Image / Icon Container -->
      <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
        @if (book.coverPath) {
          <img [src]="'local-cover:///' + book.coverPath" [alt]="book.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="w-full h-full flex flex-col items-center justify-center p-4 text-amber-500/70 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="text-xs text-center font-medium opacity-75 uppercase tracking-wider">{{ book.fileType || 'EPUB' }}</span>
          </div>
        }

        <!-- Top Badges -->
        <div class="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-500/30 uppercase tracking-wider">
            {{ book.fileType || 'EPUB' }}
          </span>

          @if (book.favorite) {
            <span class="p-1 rounded-full bg-amber-500/90 text-slate-950 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          }
        </div>

        @if (book.completed) {
          <div class="absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/90 text-slate-950 shadow">
            Concluído
          </div>
        }
      </div>

      <!-- Content Info -->
      <div class="p-3 flex flex-col flex-1 justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-amber-400 transition-colors" [title]="book.title">
            {{ book.title }}
          </h3>
          <p class="text-xs text-slate-400 line-clamp-1 mt-0.5">
            {{ book.author || book.publisher || 'Autor Desconhecido' }}
          </p>
        </div>

        <!-- Reading Progress Bar -->
        <div class="mt-3">
          <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>Pág. {{ book.bookMark || 0 }} / {{ book.pages || 0 }}</span>
            <span>{{ getProgressPercentage() }}%</span>
          </div>
          <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300" [style.width.%]="getProgressPercentage()"></div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class BookCardComponent {
  @Input({ required: true }) book!: Book;

  getProgressPercentage(): number {
    if (!this.book.pages || this.book.pages <= 0) return 0;
    return Math.min(100, Math.round(((this.book.bookMark || 0) / this.book.pages) * 100));
  }
}
