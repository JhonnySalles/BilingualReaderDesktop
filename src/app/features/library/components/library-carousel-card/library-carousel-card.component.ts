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

      <!-- Context Dropdown Menu -->
      @if (showMenu()) {
        <div
          #menuContainer
          class="fixed z-50 py-1 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl text-xs text-slate-200 min-w-44 animate-in fade-in zoom-in-95 duration-100"
          [style.top.px]="menuPosition().top"
          [style.left.px]="menuPosition().left"
          (click)="$event.stopPropagation()">

          <button
            type="button"
            (click)="onOpenClick($event)"
            class="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ler Agora
          </button>

          <button
            type="button"
            (click)="onDetailClick($event)"
            class="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Detalhes
          </button>

          <button
            type="button"
            (click)="onBookmarkClick($event)"
            class="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Marcador de Leitura
          </button>

          <button
            type="button"
            (click)="onTrackerClick($event)"
            class="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Sincronizar Leitura
          </button>

          <button
            type="button"
            (click)="onTagsClick($event)"
            class="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800/80 text-left transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Tags
          </button>
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

  @ViewChild('menuButton') menuButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('menuContainer') menuContainer?: ElementRef<HTMLDivElement>;

  showMenu = signal<boolean>(false);
  menuPosition = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private suppressClick = false;

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
    if (this.showMenu()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  private openMenu(): void {
    const rect = this.menuButton?.nativeElement.getBoundingClientRect();
    if (!rect) return;

    let top = rect.bottom + 6;
    let left = rect.left - (MENU_WIDTH - rect.width);

    if (left < 10) left = 10;
    if (left + MENU_WIDTH > window.innerWidth - 10) {
      left = window.innerWidth - MENU_WIDTH - 10;
    }
    if (top + 200 > window.innerHeight - 10) {
      top = rect.top - 200;
    }

    this.menuPosition.set({ top, left });
    this.showMenu.set(true);
  }

  closeMenu(): void {
    this.showMenu.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showMenu()) {
      const insideMenu = this.menuContainer?.nativeElement.contains(event.target as Node);
      const insideButton = this.menuButton?.nativeElement.contains(event.target as Node);
      if (!insideMenu && !insideButton) {
        this.closeMenu();
      }
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

  onOpenClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.open.emit(this.item);
  }

  onDetailClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.openDetail.emit(this.item);
  }

  onBookmarkClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.setBookmark.emit(this.item);
  }

  onTrackerClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.openTracker.emit(this.item);
  }

  onTagsClick(event: MouseEvent): void {
    event.stopPropagation();
    this.closeMenu();
    this.openTags.emit(this.item);
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearPressTimer();
  }
}
