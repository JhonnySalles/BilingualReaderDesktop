import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  ElementRef,
  ViewChild,
  HostListener,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Manga } from '../../../../../core/models';
import { MangaLibraryService } from '../../../../../core/services/manga-library.service';
import { progressPercent } from '../../../../../core/utils/reading-progress.util';

const MENU_WIDTH = 176; // w-44

@Component({
  selector: 'app-manga-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group relative bg-slate-800/40 backdrop-blur-md rounded-lg overflow-hidden border border-slate-700/40 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-stretch justify-between gap-3 pr-3">
      
      <!-- Left: Cover (Flush left, scaled up) -->
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="w-16 self-stretch min-h-[4.5rem] bg-slate-900 rounded-l-lg overflow-hidden shrink-0 relative border-r border-slate-700/50 flex items-center justify-center">
          @if (manga.coverPath) {
            <img [src]="'local-cover:///' + manga.coverPath" [alt]="manga.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          } @else {
            <div class="w-full h-full flex flex-col items-center justify-center text-slate-500 text-[10px] uppercase font-bold p-1">
              {{ manga.fileType }}
            </div>
          }
        </div>

        <!-- Stacked Buttons: Favorite + Menu -->
        <div class="flex flex-col justify-center items-center gap-1 shrink-0 py-1" (click)="$event.stopPropagation()">
          <button
            (click)="onFavoriteClick($event)"
            class="p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors"
            [title]="manga.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="manga.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          <button
            (click)="toggleMenu($event)"
            class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            title="Opções">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        <!-- Metadata -->
        <div class="min-w-0 flex-1 py-2">
          <h4 class="text-sm font-medium text-slate-200 truncate group-hover:text-indigo-400 transition-colors" [title]="manga.title">
            {{ manga.title }}
          </h4>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
            <span class="px-1.5 py-0.5 rounded bg-slate-900/80 text-indigo-300 font-mono text-[10px] border border-slate-700/60 uppercase">
              {{ manga.fileType }}
            </span>
            @if (manga.series) {
              <span class="flex items-center gap-1 text-slate-300 truncate">
                <span class="text-slate-500 font-medium">Série:</span> {{ manga.series }}
              </span>
            }
            @if (manga.author) {
              <span class="flex items-center gap-1 text-slate-300 truncate">
                <span class="text-slate-500 font-medium">Autor:</span> {{ manga.author }}
              </span>
            }
            @if (manga.publisher) {
              <span class="flex items-center gap-1 text-slate-400 truncate">
                <span class="text-slate-500 font-medium">Editora:</span> {{ manga.publisher }}
              </span>
            }
          </div>
        </div>
      </div>

      <!-- Right: Reading Progress & File Size -->
      <div class="flex items-center gap-4 shrink-0 py-2">
        <div class="w-32 hidden sm:block">
          <div class="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{{ manga.bookMark }}/{{ manga.pages }} págs</span>
            <span>{{ getProgressPercentage() }}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500 rounded-full" [style.width.%]="getProgressPercentage()"></div>
          </div>
        </div>

        <div class="text-right text-xs text-slate-400 w-16 font-mono">
          {{ formatSize(manga.fileSize) }}
        </div>
      </div>

    </div>

    <!-- Teleported dropdown (body) -->
    @if (isMenuOpen()) {
      <div
        #menuEl
        (click)="$event.stopPropagation()"
        class="fixed z-[200] w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 overflow-hidden animate-fade-in text-xs font-medium backdrop-blur-xl"
        [style.top.px]="menuPos().top"
        [style.left.px]="menuPos().left">
        <button
          (click)="onOpenTracker($event)"
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Rastreador
        </button>
        <button
          (click)="onSetBookmark($event)"
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Marcador
        </button>
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

    <!-- Teleported delete confirm (body) -->
    @if (showDeleteModal()) {
      <div
        #deleteModalEl
        (click)="$event.stopPropagation()"
        class="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center">
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
export class MangaListItemComponent implements OnDestroy {
  @Input({ required: true }) manga!: Manga;
  @Output() setBookmark = new EventEmitter<Manga>();
  @Output() openTracker = new EventEmitter<Manga>();

  private mangaService = inject(MangaLibraryService);
  private host = inject(ElementRef<HTMLElement>);

  public isMenuOpen = signal(false);
  public showDeleteModal = signal(false);
  public menuPos = signal({ top: 0, left: 0 });

  private menuButtonEl: HTMLElement | null = null;
  private menuNode: HTMLElement | null = null;
  private deleteModalNode: HTMLElement | null = null;

  @ViewChild('menuEl')
  set menuEl(ref: ElementRef<HTMLElement> | undefined) {
    if (this.menuNode && this.menuNode.parentElement === document.body) {
      this.menuNode.remove();
      this.menuNode = null;
    }
    if (ref?.nativeElement) {
      this.menuNode = ref.nativeElement;
      document.body.appendChild(this.menuNode);
      this.updateMenuPosition();
    }
  }

  @ViewChild('deleteModalEl')
  set deleteModalEl(ref: ElementRef<HTMLElement> | undefined) {
    if (this.deleteModalNode && this.deleteModalNode.parentElement === document.body) {
      this.deleteModalNode.remove();
      this.deleteModalNode = null;
    }
    if (ref?.nativeElement) {
      this.deleteModalNode = ref.nativeElement;
      document.body.appendChild(this.deleteModalNode);
    }
  }

  ngOnDestroy(): void {
    this.detachMenu();
    this.detachDeleteModal();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(ev: MouseEvent): void {
    if (!this.isMenuOpen()) return;
    const target = ev.target as Node;
    const inHost = this.host.nativeElement.contains(target);
    const inMenu = this.menuNode?.contains(target) ?? false;
    if (!inHost && !inMenu) {
      this.isMenuOpen.set(false);
    } else if (inHost && !inMenu && target !== this.menuButtonEl && !this.menuButtonEl?.contains(target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.isMenuOpen()) {
      this.updateMenuPosition();
    }
  }

  getProgressPercentage(): number {
    return progressPercent(this.manga.bookMark || 0, this.manga.pages || 0, this.manga.completed);
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.mangaService.toggleFavorite(this.manga);
    this.manga.favorite = !this.manga.favorite;
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    this.menuButtonEl = button;
    const opening = !this.isMenuOpen();
    if (opening) {
      this.updateMenuPositionFromButton(button);
      this.isMenuOpen.set(true);
      queueMicrotask(() => this.updateMenuPosition());
    } else {
      this.isMenuOpen.set(false);
    }
  }

  onOpenTracker(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.openTracker.emit(this.manga);
  }

  onSetBookmark(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.setBookmark.emit(this.manga);
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

  private updateMenuPosition(): void {
    if (this.menuButtonEl) {
      this.updateMenuPositionFromButton(this.menuButtonEl);
    }
  }

  private updateMenuPositionFromButton(button: HTMLElement): void {
    const rect = button.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    this.menuPos.set({
      top: rect.bottom + 4,
      left
    });
  }

  private detachMenu(): void {
    if (this.menuNode?.parentElement === document.body) {
      this.menuNode.remove();
    }
    this.menuNode = null;
  }

  private detachDeleteModal(): void {
    if (this.deleteModalNode?.parentElement === document.body) {
      this.deleteModalNode.remove();
    }
    this.deleteModalNode = null;
  }
}
