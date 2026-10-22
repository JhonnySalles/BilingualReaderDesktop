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
import { HistoryStatisticsItem } from '../../../core/models';
import { SharedTransitionService } from '../../../core/services/shared-transition.service';
import { formatShortDuration } from '../../../core/services/statistics.service';
import { progressPercent as calcProgressPercent } from '../../../core/utils/reading-progress.util';
import { MangaLibraryService } from '../../../core/services/manga-library.service';
import { BookLibraryService } from '../../../core/services/book-library.service';
import { ElectronService } from '../../../core/services/electron.service';

const MENU_WIDTH = 176; // w-44

@Component({
  selector: 'app-history-stats-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      (click)="open.emit(item)"
      class="group bg-slate-800/40 backdrop-blur-md rounded-lg p-2.5 border border-slate-700/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer flex items-stretch justify-between gap-4 min-h-[5rem]"
      [ngClass]="item.type === 'MANGA' ? 'manga-card-hover' : 'hover:border-amber-500/40'">

      <!-- Thumbnail & Info -->
      <div class="flex items-stretch gap-3 min-w-0 flex-initial max-w-[calc(100%-5.5rem)] sm:max-w-[55%]">
        <div
          class="relative self-stretch aspect-[2/3] min-h-[4.5rem] bg-slate-900 rounded overflow-hidden shrink-0 border border-slate-700/50"
          [style.view-transition-name]="sharedTransition.getCoverName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
          @if (item.coverPath) {
            <img
              [src]="'local-cover:///' + item.coverPath"
              [alt]="item.title"
              class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          } @else {
            <div class="absolute inset-0 flex items-center justify-center p-1">
              <span
                class="text-[10px] font-bold uppercase text-center"
                [ngClass]="item.type === 'MANGA' ? 'text-indigo-400' : 'text-amber-400'">
                {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
              </span>
            </div>
          }
        </div>

        <div class="min-w-0 flex-1 flex flex-col justify-center py-0.5">
          <div class="flex items-center gap-2">
            <h4
              class="text-sm font-medium text-slate-200 truncate transition-colors"
              [ngClass]="item.type === 'MANGA' ? 'manga-title-hover' : 'group-hover:text-amber-400'"
              [title]="item.title"
              [style.view-transition-name]="sharedTransition.getTitleName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
              {{ item.title }}
            </h4>
            @if (item.favorite) {
              <span class="text-amber-400 text-xs">★</span>
            }
          </div>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
            <span
              class="px-1.5 py-0.5 rounded bg-slate-900/80 font-mono text-[10px] border uppercase"
              [ngClass]="item.type === 'MANGA' ? 'manga-badge' : 'text-amber-300 border-slate-700/60'">
              {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
            </span>

            @if (item.series) {
              <span class="flex items-center gap-1 text-slate-300">
                <span class="text-slate-500 font-medium">Série:</span> {{ item.series }}
              </span>
            }
            @if (item.author) {
              <span class="flex items-center gap-1 text-slate-300">
                <span class="text-slate-500 font-medium">Autor:</span> {{ item.author }}
              </span>
            }
            @if (item.publisher) {
              <span class="flex items-center gap-1 text-slate-400">
                <span class="text-slate-500 font-medium">Editora:</span> {{ item.publisher }}
              </span>
            }

            <span class="text-slate-500">·</span>
            <span class="text-emerald-400 font-medium">
              +{{ item.pagesRead }} pág.
            </span>
            <span class="text-slate-400">
              ({{ formatTime(item.timeRead) }})
            </span>
            @if (item.libraryName) {
              <span class="text-slate-500">· {{ item.libraryName }}</span>
            }
          </div>
        </div>
      </div>

      <!-- Reading Progress (Ocupa o espaço livre disponível) -->
      <div class="flex-1 min-w-[120px] hidden sm:flex flex-col justify-center px-2">
        <div class="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>{{ item.bookMark }}/{{ item.pages }} págs</span>
          <span>{{ progressPercent() }}%</span>
        </div>
        <div class="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden" [style.view-transition-name]="sharedTransition.getProgressName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
          <div
            class="h-full rounded-full transition-all duration-300"
            [ngClass]="item.type === 'MANGA' ? 'manga-progress-bar' : 'bg-gradient-to-r from-amber-500 to-orange-500'"
            [style.width.%]="progressPercent()"></div>
        </div>
      </div>

      <!-- Time & Options Menu Trigger -->
      <div class="shrink-0 flex items-center gap-2" (click)="$event.stopPropagation()">
        <div class="text-right text-xs text-slate-400 w-16 font-mono">
          {{ formatClock(item.lastAccess) || item.sessionDate }}
        </div>

        <button
          #menuButton
          type="button"
          (click)="toggleMenu($event)"
          class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
          title="Opções">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
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
        <!-- 1. Favorito -->
        <button
          type="button"
          (click)="onToggleFavorite($event)"
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-amber-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" [class.fill-current]="item.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Favorito
        </button>

        <!-- 2. Limpar histórico -->
        <button
          type="button"
          (click)="onPromptClearHistory($event)"
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-amber-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Limpar histórico
        </button>

        <!-- 3. Excluir arquivo -->
        <button
          type="button"
          (click)="onPromptDelete($event)"
          class="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Excluir arquivo
        </button>
      </div>
    }

    <!-- Teleported modal de Limpar Histórico (body) -->
    @if (showClearHistoryModal()) {
      <div
        #clearHistoryModalEl
        (click)="$event.stopPropagation()"
        class="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center">
          <div class="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-100">Limpar histórico</h3>
            <p class="text-xs text-slate-400 mt-1 break-words">
              Deseja limpar todo o histórico de leitura de <strong>"{{ item.title }}"</strong>?
            </p>
          </div>
          <div class="flex flex-col gap-2 mt-3 w-full">
            <button
              type="button"
              (click)="confirmClearHistory($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-600/20 w-full cursor-pointer">
              Limpar histórico
            </button>
            <button
              type="button"
              (click)="cancelClearHistory($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Teleported modal de Excluir Arquivo (body) -->
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
              type="button"
              (click)="confirmDelete($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 w-full cursor-pointer">
              Confirmar
            </button>
            <button
              type="button"
              (click)="cancelDelete($event)"
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class HistoryStatsListItemComponent implements OnDestroy {
  @Input({ required: true }) item!: HistoryStatisticsItem;
  @Input() instanceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  @Output() open = new EventEmitter<HistoryStatisticsItem>();
  @Output() favoriteChange = new EventEmitter<HistoryStatisticsItem>();
  @Output() historyCleared = new EventEmitter<HistoryStatisticsItem>();
  @Output() fileDeleted = new EventEmitter<HistoryStatisticsItem>();

  public sharedTransition = inject(SharedTransitionService);
  private mangaLibrary = inject(MangaLibraryService);
  private bookLibrary = inject(BookLibraryService);
  private electron = inject(ElectronService);
  private host = inject(ElementRef<HTMLElement>);

  public isMenuOpen = signal(false);
  public showDeleteModal = signal(false);
  public showClearHistoryModal = signal(false);
  public menuPos = signal({ top: 0, left: 0 });

  private menuButtonEl: HTMLElement | null = null;
  private menuNode: HTMLElement | null = null;
  private deleteModalNode: HTMLElement | null = null;
  private clearHistoryModalNode: HTMLElement | null = null;

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

  @ViewChild('clearHistoryModalEl')
  set clearHistoryModalEl(ref: ElementRef<HTMLElement> | undefined) {
    if (this.clearHistoryModalNode && this.clearHistoryModalNode.parentElement === document.body) {
      this.clearHistoryModalNode.remove();
      this.clearHistoryModalNode = null;
    }
    if (ref?.nativeElement) {
      this.clearHistoryModalNode = ref.nativeElement;
      document.body.appendChild(this.clearHistoryModalNode);
    }
  }

  ngOnDestroy(): void {
    this.detachMenu();
    this.detachDeleteModal();
    this.detachClearHistoryModal();
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

  progressPercent(): number {
    return calcProgressPercent(this.item.bookMark || 0, this.item.pages || 0, this.item.completed);
  }

  formatTime(seconds: number): string {
    return formatShortDuration(seconds);
  }

  formatClock(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  async onToggleFavorite(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    const newFavorite = !this.item.favorite;
    this.item.favorite = newFavorite;

    if (this.item.type === 'MANGA') {
      if (window.electronAPI?.saveManga) {
        await window.electronAPI.saveManga({ id: this.item.fkReference, favorite: newFavorite });
      }
      this.mangaLibrary.mangas.update(list =>
        list.map(m => m.id === this.item.fkReference ? { ...m, favorite: newFavorite } : m)
      );
    } else {
      if (window.electronAPI?.saveBook) {
        await window.electronAPI.saveBook({ id: this.item.fkReference, favorite: newFavorite });
      }
      this.bookLibrary.books.update(list =>
        list.map(b => b.id === this.item.fkReference ? { ...b, favorite: newFavorite } : b)
      );
    }
    this.favoriteChange.emit(this.item);
  }

  onPromptClearHistory(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.set(false);
    this.showClearHistoryModal.set(true);
  }

  cancelClearHistory(event: MouseEvent): void {
    event.stopPropagation();
    this.showClearHistoryModal.set(false);
  }

  async confirmClearHistory(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showClearHistoryModal.set(false);
    await this.electron.deleteHistoryByReference(this.item.fkReference, this.item.type);
    this.historyCleared.emit(this.item);
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

  async confirmDelete(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.showDeleteModal.set(false);
    if (this.item.type === 'MANGA') {
      await this.mangaLibrary.deleteManga({ id: this.item.fkReference } as any);
    } else {
      await this.bookLibrary.deleteBook({ id: this.item.fkReference } as any);
    }
    this.fileDeleted.emit(this.item);
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

  private detachClearHistoryModal(): void {
    if (this.clearHistoryModalNode?.parentElement === document.body) {
      this.clearHistoryModalNode.remove();
    }
    this.clearHistoryModalNode = null;
  }
}
