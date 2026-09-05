import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga } from '../../../../../core/models';
import { MangaLibraryService } from '../../../../../core/services/manga-library.service';

@Component({
  selector: 'app-manga-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- STANDARD CARD STYLE -->
    @if (cardStyle === 'STANDARD') {
      <div class="group relative bg-slate-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer flex flex-col h-full">
        <!-- Cover Image Container -->
        <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-900">
          @if (manga.coverPath) {
            <img [src]="'local-cover:///' + manga.coverPath" [alt]="manga.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          } @else {
            <div class="w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span class="text-xs text-center font-medium opacity-75 uppercase tracking-wider">{{ manga.fileType }}</span>
            </div>
          }

          <!-- Top Badges & Actions -->
          <div class="absolute top-2 left-2 right-2 flex justify-between items-center z-10 pointer-events-auto">
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/30 uppercase tracking-wider shadow">
              {{ manga.fileType }}
            </span>

            <div class="flex items-center gap-1.5">
              <!-- Favorite Button -->
              <button
                (click)="onFavoriteClick($event)"
                [class.opacity-100]="manga.favorite"
                [class.opacity-0]="!manga.favorite"
                class="group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full text-amber-400 hover:scale-110 border bg-transparent border-transparent shadow-none group-hover:bg-slate-950/80 group-hover:backdrop-blur-md group-hover:border-amber-500/20 group-hover:shadow-md translate-x-7 group-hover:translate-x-0"
                [title]="manga.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="manga.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              <!-- 3-Dots Menu Button -->
              <div class="relative">
                <button
                  (click)="toggleMenu($event)"
                  class="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-white hover:scale-110 shadow-md border border-slate-700/50"
                  title="Opções">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                @if (isMenuOpen()) {
                  <div (click)="$event.stopPropagation()" class="absolute right-0 top-8 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-30 py-1 overflow-hidden animate-fade-in text-xs font-medium backdrop-blur-xl">
                    <button
                      (click)="onClearProgress($event)"
                      class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Limpar progresso
                    </button>
                    <button
                      (click)="onPromptDelete($event)"
                      class="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Deletar
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          @if (manga.completed) {
            <div class="absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/90 text-slate-950 shadow">
              Concluído
            </div>
          }
        </div>

        <!-- Content Info -->
        <div class="p-3 flex flex-col flex-1 justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 group-hover:text-indigo-400 transition-colors" [title]="manga.title">
              {{ manga.title }}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-1 mt-0.5">
              {{ manga.author || manga.series || 'Desconhecido' }}
            </p>
          </div>

          <!-- Reading Progress Bar -->
          <div class="mt-3">
            <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>Pág. {{ manga.bookMark }} / {{ manga.pages }}</span>
              <span>{{ getProgressPercentage() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" [style.width.%]="getProgressPercentage()"></div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- OVERLAY CARD STYLE -->
    @if (cardStyle === 'OVERLAY') {
      <div class="group relative aspect-[2/3] w-full rounded-xl overflow-hidden border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer flex flex-col justify-between bg-slate-900">
        <!-- Background Cover Image -->
        @if (manga.coverPath) {
          <img [src]="'local-cover:///' + manga.coverPath" [alt]="manga.title" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="text-xs text-center font-medium opacity-75 uppercase tracking-wider">{{ manga.fileType }}</span>
          </div>
        }

        <!-- Gradient Backdrop Shadow overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

        <!-- Top Badges & Actions -->
        <div class="relative z-10 p-2.5 flex justify-between items-center pointer-events-auto">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/30 uppercase tracking-wider shadow">
            {{ manga.fileType }}
          </span>

          <div class="flex items-center gap-1.5">
            <!-- Favorite Button -->
            <button
              (click)="onFavoriteClick($event)"
              [class.opacity-100]="manga.favorite"
              [class.opacity-0]="!manga.favorite"
              class="group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full text-amber-400 hover:scale-110 border bg-transparent border-transparent shadow-none group-hover:bg-slate-950/80 group-hover:backdrop-blur-md group-hover:border-amber-500/20 group-hover:shadow-md translate-x-7 group-hover:translate-x-0"
              [title]="manga.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="manga.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            <!-- 3-Dots Menu Button -->
            <div class="relative">
              <button
                (click)="toggleMenu($event)"
                class="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-white hover:scale-110 shadow-md border border-slate-700/50"
                title="Opções">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              <!-- Dropdown Menu -->
              @if (isMenuOpen()) {
                <div (click)="$event.stopPropagation()" class="absolute right-0 top-8 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-30 py-1 overflow-hidden animate-fade-in text-xs font-medium backdrop-blur-xl">
                  <button
                    (click)="onClearProgress($event)"
                    class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Limpar progresso
                  </button>
                  <button
                    (click)="onPromptDelete($event)"
                    class="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Deletar
                  </button>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Bottom Blur Details Overlay -->
        <div class="relative z-10 p-3 bg-slate-950/70 backdrop-blur-md border-t border-slate-700/40">
          <h3 class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 group-hover:text-indigo-400 transition-colors" [title]="manga.title">
            {{ manga.title }}
          </h3>
          <p class="text-xs text-slate-300 line-clamp-1 mt-0.5 opacity-80">
            {{ manga.author || manga.series || 'Desconhecido' }}
          </p>

          <!-- Reading Progress Bar -->
          <div class="mt-2.5">
            <div class="flex justify-between items-center text-[10px] text-slate-300 mb-1 font-mono opacity-90">
              <span>{{ manga.bookMark }}/{{ manga.pages }}p</span>
              <span>{{ getProgressPercentage() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" [style.width.%]="getProgressPercentage()"></div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- CONFIRM DELETE MODAL OVERLAY -->
    @if (showDeleteModal()) {
      <div (click)="$event.stopPropagation()" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center">
          <div class="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-100">Excluir item</h3>
            <p class="text-xs text-slate-400 mt-1 break-words">
              Deseja remover <strong>"{{ manga.title }}"</strong> da biblioteca?
            </p>
          </div>
          <div class="flex flex-col gap-2 mt-3 w-full">
            <button
              (click)="confirmDelete($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 w-full">
              Confirmar
            </button>
            <button
              (click)="cancelDelete($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class MangaCardComponent {
  @Input({ required: true }) manga!: Manga;
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';

  private mangaService = inject(MangaLibraryService);
  public isMenuOpen = signal<boolean>(false);
  public showDeleteModal = signal<boolean>(false);

  getProgressPercentage(): number {
    if (!this.manga.pages || this.manga.pages <= 0) return 0;
    return Math.min(100, Math.round((this.manga.bookMark / this.manga.pages) * 100));
  }

  onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.mangaService.toggleFavorite(this.manga);
    this.manga.favorite = !this.manga.favorite; // Optimistic UI update
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update(v => !v);
  }

  onClearProgress(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.mangaService.clearProgress(this.manga);
  }

  onPromptDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.showDeleteModal.set(true);
  }

  cancelDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.showDeleteModal.set(false);
  }

  confirmDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.showDeleteModal.set(false);
    this.mangaService.deleteManga(this.manga);
  }
}
