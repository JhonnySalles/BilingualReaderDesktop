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
import { Manga, Book, OrderType } from '../../../../core/models';
import { SharedTransitionService } from '../../../../core/services/shared-transition.service';
import { MangaLibraryService } from '../../../../core/services/manga-library.service';
import { BookLibraryService } from '../../../../core/services/book-library.service';
import { progressPercent } from '../../../../core/utils/reading-progress.util';

const MENU_WIDTH = 180;

@Component({
  selector: 'app-library-carousel-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group relative flex-none w-36 sm:w-40 bg-slate-900/90 rounded-xl overflow-hidden border transition-all duration-300 flex flex-col select-none cursor-pointer"
      [ngClass]="type === 'manga'
        ? 'border-slate-800/80 manga-card-hover hover:shadow-xl hover:-translate-y-1.5'
        : 'border-slate-800/80 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1.5'"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerCancel()"
      (pointerleave)="onPointerCancel()"
      (click)="onClick($event)"
      (contextmenu)="onContextMenu($event)"
      [title]="item.title">

      <!-- Cover Container (Aspect Ratio 2:3) -->
      <div
        class="relative aspect-[2/3] w-full overflow-hidden bg-slate-950"
        [style.view-transition-name]="sharedTransition.getCoverName(item.id, type, instanceId)">

        @if (item.coverPath) {
          <img
            [src]="'local-cover:///' + item.coverPath"
            [alt]="item.title"
            loading="lazy"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" />
        } @else {
          <div
            class="w-full h-full flex flex-col items-center justify-center p-3 text-center"
            [ngClass]="type === 'manga'
              ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 text-[#818cf8]'
              : 'bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 text-amber-400'">
            <span class="text-3xl mb-1.5">{{ type === 'manga' ? '🎨' : '📚' }}</span>
            <span class="text-[10px] uppercase font-bold tracking-wider opacity-80">{{ item.fileType || (type === 'manga' ? 'MANGA' : 'EPUB') }}</span>
          </div>
        }

        <!-- Top Badges & Actions -->
        <div class="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-center z-10 pointer-events-auto">
          <!-- File Type Badge -->
          <span
            class="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-slate-950/85 backdrop-blur-md uppercase tracking-wider border shadow-sm pointer-events-none"
            [ngClass]="type === 'manga'
              ? 'manga-badge'
              : 'text-amber-300 border-amber-500/30'">
            {{ item.fileType || (type === 'manga' ? 'CBZ' : 'EPUB') }}
          </span>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-1">
            <!-- Favorite button -->
            <button
              type="button"
              (click)="onFavoriteClick($event)"
              [class.opacity-100]="item.favorite"
              [class.opacity-0]="!item.favorite"
              class="group-hover:opacity-100 transition-all duration-200 p-1 rounded-full text-amber-400 hover:scale-110 bg-slate-950/80 backdrop-blur-md border border-slate-700/50 shadow"
              [title]="item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" [class.fill-current]="item.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            <!-- Options trigger -->
            <button
              #menuButton
              type="button"
              (click)="toggleMenu($event)"
              class="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-white hover:scale-110 shadow border border-slate-700/50"
              title="Opções">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Completed Badge -->
        @if (item.completed) {
          <div class="absolute bottom-2 right-2 px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/90 text-slate-950 shadow-md">
            Concluído
          </div>
        }

        <!-- Reading Progress Bar (Overlay on Bottom of Cover) -->
        <div
          class="absolute bottom-0 left-0 right-0 h-1 bg-slate-950/70 overflow-hidden"
          [style.view-transition-name]="sharedTransition.getProgressName(item.id, type, instanceId)">
          <div
            class="h-full rounded-r transition-all duration-300"
            [ngClass]="type === 'manga'
              ? 'manga-progress-bar'
              : 'bg-gradient-to-r from-amber-500 to-orange-500'"
            [style.width.%]="getProgressPercentage()">
          </div>
        </div>

      </div>

      <!-- Card Footer / Title -->
      <div class="p-2.5 flex flex-col justify-between flex-1 min-h-[3.75rem] bg-slate-900/60">
        <div>
          <!-- If in Series Mode, highlight volume nicely -->
          @if (isSeriesOrder && hasVolume) {
            <div class="flex items-baseline justify-between gap-1">
              <span
                class="text-xs font-bold font-mono tracking-tight"
                [ngClass]="type === 'manga' ? 'text-[#a5b4fc]' : 'text-amber-300'">
                {{ getFormattedVolume() }}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">
                {{ item.bookMark || 0 }}/{{ item.pages || 0 }}p
              </span>
            </div>
            <p
              class="text-[11px] text-slate-400 truncate mt-0.5"
              [style.view-transition-name]="sharedTransition.getTitleName(item.id, type, instanceId)">
              {{ item.title }}
            </p>
          } @else {
            <h4
              class="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight transition-colors"
              [ngClass]="type === 'manga' ? 'manga-title-hover' : 'group-hover:text-amber-400'"
              [style.view-transition-name]="sharedTransition.getTitleName(item.id, type, instanceId)">
              {{ item.title }}
            </h4>
            <div class="flex items-center justify-between mt-1 text-[10px] text-slate-400">
              <span class="truncate max-w-[70%]">{{ item.author || (type === 'manga' ? 'Mangá' : 'Livro') }}</span>
              <span class="font-mono">{{ getProgressPercentage() }}%</span>
            </div>
          }
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
            class="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 flex items-center gap-2 transition-colors"
            [ngClass]="type === 'manga' ? 'hover:text-[#818cf8]' : 'hover:text-amber-400'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" [ngClass]="type === 'manga' ? 'text-[#818cf8]' : 'text-amber-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Rastreador
          </button>
          <button
            (click)="onSetBookmark($event)"
            class="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 flex items-center gap-2 transition-colors"
            [ngClass]="type === 'manga' ? 'hover:text-[#818cf8]' : 'hover:text-amber-400'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" [ngClass]="type === 'manga' ? 'text-[#818cf8]' : 'text-amber-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Marcador
          </button>
          <button
            (click)="onOpenTags($event)"
            class="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 flex items-center gap-2 transition-colors"
            [ngClass]="type === 'manga' ? 'hover:text-[#818cf8]' : 'hover:text-amber-400'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" [ngClass]="type === 'manga' ? 'text-[#818cf8]' : 'text-amber-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Tags
          </button>
          <button
            (click)="onClearProgress($event)"
            class="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800/80 flex items-center gap-2 transition-colors"
            [ngClass]="type === 'manga' ? 'hover:text-[#818cf8]' : 'hover:text-amber-400'">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" [ngClass]="type === 'manga' ? 'text-[#818cf8]' : 'text-amber-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
                Deseja remover <strong>"{{ item.title }}"</strong> da biblioteca?
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

    </div>
  `
})
export class LibraryCarouselCardComponent implements OnDestroy {
  @Input({ required: true }) item!: Manga | Book;
  @Input() type: 'manga' | 'book' = 'manga';
  @Input() order: OrderType = OrderType.Name;
  @Input() instanceId: string = 'carousel';

  @Output() open = new EventEmitter<Manga | Book>();
  @Output() openDetail = new EventEmitter<Manga | Book>();
  @Output() setBookmark = new EventEmitter<Manga | Book>();
  @Output() openTracker = new EventEmitter<Manga | Book>();
  @Output() openTags = new EventEmitter<Manga | Book>();

  public sharedTransition = inject(SharedTransitionService);
  private mangaService = inject(MangaLibraryService);
  private bookService = inject(BookLibraryService);
  private host = inject(ElementRef<HTMLElement>);

  public isMenuOpen = signal(false);
  public showDeleteModal = signal(false);
  public menuPos = signal({ top: 0, left: 0 });

  private menuButtonEl: HTMLElement | null = null;
  private menuNode: HTMLElement | null = null;
  private deleteModalNode: HTMLElement | null = null;

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private suppressClick = false;

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

  get isSeriesOrder(): boolean {
    return this.order === OrderType.Series;
  }

  get hasVolume(): boolean {
    const vol = (this.item as any).volume;
    return typeof vol === 'string' && vol.trim().length > 0;
  }

  getFormattedVolume(): string {
    const vol = (this.item as any).volume || '';
    const digits = vol.replace(/\D/g, '');
    if (!digits) {
      return vol ? `Vol. ${vol}` : 'Vol. 01';
    }
    const num = parseInt(digits, 10);
    return isNaN(num) ? `Vol. ${vol}` : `Vol. ${String(num).padStart(2, '0')}`;
  }

  getProgressPercentage(): number {
    return progressPercent(this.item.bookMark || 0, this.item.pages || 0, this.item.completed);
  }

  onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.type === 'manga') {
      this.mangaService.toggleFavorite(this.item as Manga);
    } else {
      this.bookService.toggleFavorite(this.item as Book);
    }
    this.item.favorite = !this.item.favorite;
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

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.longPressFired = false;
    this.suppressClick = false;
    this.clearPressTimer();
    this.pressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.suppressClick = true;
      this.openDetail.emit(this.item);
    }, 450);
  }

  onPointerUp(_event: PointerEvent): void {
    this.clearPressTimer();
  }

  onPointerCancel(): void {
    this.clearPressTimer();
  }

  onClick(event: MouseEvent): void {
    if (this.suppressClick || this.longPressFired) {
      event.preventDefault();
      event.stopPropagation();
      this.suppressClick = false;
      this.longPressFired = false;
      return;
    }
    this.open.emit(this.item);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.clearPressTimer();
    this.openDetail.emit(this.item);
  }

  onOpenTracker(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.openTracker.emit(this.item);
  }

  onSetBookmark(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.setBookmark.emit(this.item);
  }

  onOpenTags(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.openTags.emit(this.item);
  }

  onClearProgress(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    if (this.type === 'manga') {
      this.mangaService.clearProgress(this.item as Manga);
    } else {
      this.bookService.clearProgress(this.item as Book);
    }
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
    if (this.type === 'manga') {
      this.mangaService.deleteManga(this.item as Manga);
    } else {
      this.bookService.deleteBook(this.item as Book);
    }
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

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearPressTimer();
    this.detachMenu();
    this.detachDeleteModal();
  }
}
