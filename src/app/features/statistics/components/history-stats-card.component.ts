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
  selector: 'app-history-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- STANDARD CARD STYLE -->
    @if (cardStyle === 'STANDARD') {
      <div
        (click)="open.emit(item)"
        class="group relative w-full text-left bg-slate-800/60 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col h-full hover:shadow-xl select-none"
        [ngClass]="cardHoverClass">

        <!-- Cover Image Container -->
        <div class="relative aspect-[2/3] w-full overflow-hidden bg-slate-900" [style.view-transition-name]="sharedTransition.getCoverName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
          @if (item.coverPath) {
            <img
              [src]="'local-cover:///' + item.coverPath"
              [alt]="item.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          } @else {
            <div class="w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span class="text-xs uppercase tracking-wider opacity-75 font-semibold">{{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}</span>
            </div>
          }

          <!-- Top Badges & Actions (Hover similar à biblioteca) -->
          <div class="absolute top-2 left-2 right-2 flex justify-between items-center z-10 pointer-events-auto">
            <span
              class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md border uppercase tracking-wider shadow"
              [ngClass]="badgeClass">
              {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
            </span>

            <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()">
              <!-- Quick Favorite Button -->
              <button
                type="button"
                (click)="onToggleFavorite($event)"
                [class.opacity-100]="item.favorite"
                [class.opacity-0]="!item.favorite"
                class="group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full text-indigo-400 hover:scale-110 border bg-transparent border-transparent shadow-none group-hover:bg-slate-950/80 group-hover:backdrop-blur-md group-hover:border-indigo-500/20 group-hover:shadow-md translate-x-7 group-hover:translate-x-0 cursor-pointer"
                [title]="item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="item.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              <!-- Menu Button -->
              <button
                #menuButtonStandard
                type="button"
                (click)="toggleMenu($event)"
                class="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-white hover:scale-110 shadow-md border border-slate-700/50 cursor-pointer"
                title="Opções">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Bottom Session Stats overlay -->
          <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent">
            <div class="flex justify-between text-[10px] text-slate-200 font-semibold">
              <span class="text-emerald-400">+{{ item.pagesRead }} pág.</span>
              <span>{{ formatTime(item.timeRead) }}</span>
            </div>
          </div>
        </div>

        <!-- Content Info -->
        <div class="p-3 flex flex-col flex-1 justify-between gap-2">
          <div>
            <h3
              class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 transition-colors"
              [ngClass]="titleHoverClass"
              [title]="item.title"
              [style.view-transition-name]="sharedTransition.getTitleName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
              {{ item.title }}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-1 mt-0.5">
              @if (item.type === 'MANGA') {
                {{ item.series || item.author || 'Desconhecido' }}
              } @else {
                {{ item.author || item.publisher || 'Autor Desconhecido' }}
              }
            </p>
            <p class="text-[10px] text-slate-500 mt-1">
              {{ item.sessionDate }} · {{ formatClock(item.lastAccess) }}
              @if (item.libraryName) {
                · {{ item.libraryName }}
              }
            </p>
          </div>

          <!-- Reading Progress Bar -->
          <div class="mt-1">
            <div class="flex justify-between items-center text-[10px] text-slate-400 mb-1">
              <span>Pág. {{ item.bookMark }} / {{ item.pages }}</span>
              <span>{{ progressPercent() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden" [style.view-transition-name]="sharedTransition.getProgressName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
              <div
                class="h-full rounded-full transition-all duration-300 bg-gradient-to-r"
                [ngClass]="barClass"
                [style.width.%]="progressPercent()"></div>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- OVERLAY CARD STYLE -->
    @if (cardStyle === 'OVERLAY') {
      <div
        (click)="open.emit(item)"
        class="group relative aspect-[2/3] w-full text-left rounded-xl overflow-hidden border border-slate-700/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between bg-slate-900 select-none"
        [ngClass]="cardHoverClass"
        [style.view-transition-name]="sharedTransition.getCoverName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">

        <!-- Background Cover Image -->
        @if (item.coverPath) {
          <img
            [src]="'local-cover:///' + item.coverPath"
            [alt]="item.title"
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        } @else {
          <div class="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 text-slate-500 bg-gradient-to-br from-slate-900 to-slate-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span class="text-xs uppercase tracking-wider opacity-75 font-semibold">{{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}</span>
          </div>
        }

        <!-- Gradient Backdrop Shadow overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

        <!-- Top Badges & Actions (Hover similar à biblioteca) -->
        <div class="relative z-10 p-2.5 flex justify-between items-center pointer-events-auto">
          <span
            class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-950/80 backdrop-blur-md border uppercase tracking-wider shadow"
            [ngClass]="badgeClass">
            {{ item.type === 'MANGA' ? 'Manga' : 'Livro' }}
          </span>

          <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()">
            <!-- Quick Favorite Button -->
            <button
              type="button"
              (click)="onToggleFavorite($event)"
              [class.opacity-100]="item.favorite"
              [class.opacity-0]="!item.favorite"
              class="group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full text-indigo-400 hover:scale-110 border bg-transparent border-transparent shadow-none group-hover:bg-slate-950/80 group-hover:backdrop-blur-md group-hover:border-indigo-500/20 group-hover:shadow-md translate-x-7 group-hover:translate-x-0 cursor-pointer"
              [title]="item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" [class.fill-current]="item.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            <!-- Menu Button -->
            <button
              #menuButtonOverlay
              type="button"
              (click)="toggleMenu($event)"
              class="opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-full bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-white hover:scale-110 shadow-md border border-slate-700/50 cursor-pointer"
              title="Opções">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Bottom Blur Details Overlay -->
        <div class="relative z-10 p-3 bg-slate-950/75 backdrop-blur-md border-t border-slate-700/40">
          <div class="flex justify-between text-[10px] text-slate-300 mb-1 font-medium">
            <span class="text-emerald-400 font-semibold">+{{ item.pagesRead }} pág.</span>
            <span>{{ formatTime(item.timeRead) }}</span>
          </div>

          <h3
            class="text-sm font-semibold text-slate-100 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 lg:line-clamp-5 transition-colors"
            [ngClass]="titleHoverClass"
            [title]="item.title"
            [style.view-transition-name]="sharedTransition.getTitleName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
            {{ item.title }}
          </h3>
          <p class="text-xs text-slate-300 line-clamp-1 mt-0.5 opacity-80">
            @if (item.type === 'MANGA') {
              {{ item.series || item.author || 'Desconhecido' }}
            } @else {
              {{ item.author || item.publisher || 'Autor Desconhecido' }}
            }
          </p>

          <!-- Reading Progress Bar -->
          <div class="mt-2">
            <div class="flex justify-between items-center text-[10px] text-slate-300 mb-1 font-mono opacity-90">
              <span>{{ item.bookMark }}/{{ item.pages }}p</span>
              <span>{{ progressPercent() }}%</span>
            </div>
            <div class="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden" [style.view-transition-name]="sharedTransition.getProgressName(item.fkReference, item.type === 'MANGA' ? 'manga' : 'book', instanceId)">
              <div
                class="h-full rounded-full transition-all duration-300 bg-gradient-to-r"
                [ngClass]="barClass"
                [style.width.%]="progressPercent()"></div>
            </div>
          </div>
        </div>
      </div>
    }

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
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" [class.fill-current]="item.favorite" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Favorito
        </button>

        <!-- 2. Limpar histórico -->
        <button
          type="button"
          (click)="onPromptClearHistory($event)"
          class="w-full px-3 py-2 text-left text-slate-300 hover:text-indigo-400 hover:bg-slate-800/80 flex items-center gap-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
          <div class="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
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
              class="px-4 py-2.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 w-full cursor-pointer">
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
export class HistoryStatsCardComponent implements OnDestroy {
  @Input({ required: true }) item!: HistoryStatisticsItem;
  @Input() cardStyle: 'STANDARD' | 'OVERLAY' = 'STANDARD';
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

  get cardHoverClass(): string {
    return this.item.type === 'MANGA'
      ? 'manga-card-hover'
      : 'hover:border-amber-500/50 hover:shadow-amber-500/10';
  }

  get badgeClass(): string {
    return this.item.type === 'MANGA'
      ? 'manga-badge'
      : 'text-amber-300 border-amber-500/30';
  }

  get titleHoverClass(): string {
    return this.item.type === 'MANGA' ? 'manga-title-hover' : 'group-hover:text-amber-400';
  }

  get barClass(): string {
    return this.item.type === 'MANGA' ? 'manga-progress-bar' : 'bg-gradient-to-r from-amber-500 to-orange-500';
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
