import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from '../../core/services/electron.service';
import { VocabularyUiStateService } from '../../core/services/vocabulary-ui-state.service';
import {
  Kanjax,
  Vocabulary,
  VocabularyBook,
  VocabularyManga
} from '../../core/models';
import {
  VocabularyCardComponent,
  VocabularyDetailDialogComponent,
  KanjaxDetailDialogComponent
} from './components/vocabulary-card.component';

const PAGE_SIZE = 40;

@Component({
  selector: 'app-vocabulary',
  standalone: true,
  imports: [
    CommonModule,
    VocabularyCardComponent,
    VocabularyDetailDialogComponent,
    KanjaxDetailDialogComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      @if (detail(); as d) {
        <app-vocabulary-detail-dialog
          [item]="d"
          (close)="detail.set(null)"
          (openKanji)="onOpenKanji($event)" />
      }
      @if (kanji(); as k) {
        <app-kanjax-detail-dialog [item]="k" (close)="kanji.set(null)" />
      }

      @if (ui.showOrderPopup()) {
        <div class="absolute inset-0 z-40 flex items-start justify-end bg-black/40 p-4 pt-16"
          (click)="ui.showOrderPopup.set(false)">
          <div class="w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-2"
            (click)="$event.stopPropagation()">
            <p class="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">Ordenar por</p>
            @for (opt of orderOptions; track opt.value) {
              <button type="button"
                class="w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer"
                [class.bg-indigo-600]="ui.order() === opt.value"
                [class.text-white]="ui.order() === opt.value"
                [class.text-slate-300]="ui.order() !== opt.value"
                [class.hover:bg-slate-800]="ui.order() !== opt.value"
                (click)="selectOrder(opt.value)">
                {{ opt.label }}
              </button>
            }
            <button type="button"
              class="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-400 hover:bg-slate-800 cursor-pointer mt-1"
              (click)="toggleSortDir()">
              {{ ui.desc() ? 'Descendente' : 'Ascendente' }} (inverter)
            </button>
          </div>
        </div>
      }

      <div class="flex-1 min-h-0 overflow-y-auto p-6" (scroll)="onScroll($event)">
        @if (ui.isScoped()) {
          <div class="max-w-3xl mx-auto mb-4 flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
              [ngClass]="ui.mangaId() != null
                ? 'bg-indigo-950/50 border-indigo-700/50 text-indigo-200'
                : 'bg-amber-950/40 border-amber-700/40 text-amber-200'">
              {{ ui.scopeTitle() || (ui.mangaId() != null ? 'Mangá' : 'Livro') }}
            </span>
            <button type="button" (click)="clearScope()"
              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 border border-slate-800 hover:border-slate-600 cursor-pointer">
              Ver todos
            </button>
            @if (ui.mangaId() != null || ui.bookId() != null) {
              <button type="button" (click)="importScoped()" [disabled]="importing()"
                class="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer">
                {{ importing() ? 'Importando…' : 'Importar vocabulário' }}
              </button>
            }
          </div>
        }

        @if (toast()) {
          <div class="max-w-3xl mx-auto mb-3 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
            {{ toast() }}
          </div>
        }

        @if (loading() && items().length === 0) {
          <p class="text-xs text-slate-500 text-center py-16">Carregando vocabulário…</p>
        } @else if (items().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 text-center px-6">
            <div class="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-indigo-400">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <p class="text-sm font-semibold text-slate-200">Nenhuma palavra encontrada</p>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">
              @if (ui.isScoped()) {
                Importe o vocabulário deste título (legendas JP no mangá ou texto do livro) para vê-lo aqui.
              } @else {
                O dicionário é carregado na primeira execução. Tente limpar a busca ou filtros.
              }
            </p>
            @if (ui.isScoped()) {
              <button type="button" (click)="importScoped()" [disabled]="importing()"
                class="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer">
                {{ importing() ? 'Importando…' : 'Importar agora' }}
              </button>
            }
          </div>
        } @else {
          <div class="space-y-2 max-w-3xl mx-auto">
            <p class="text-[11px] text-slate-500 px-1 mb-1">{{ total() }} palavras</p>
            @for (item of items(); track item.id) {
              <app-vocabulary-card
                [item]="item"
                [showEnglish]="!ui.isScoped()"
                [showGlobalActions]="!ui.isScoped()"
                [relatedMangas]="relatedFor(item).mangas"
                [relatedBooks]="relatedFor(item).books"
                (open)="detail.set($event)"
                (favoriteChanged)="onFavoriteChanged($event)"
                (filterManga)="focusRelated('manga', $event)"
                (filterBook)="focusRelated('book', $event)" />
            }
            @if (loadingMore()) {
              <p class="text-center text-[11px] text-slate-500 py-4">Carregando mais…</p>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class VocabularyComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  ui = inject(VocabularyUiStateService);

  items = signal<Vocabulary[]>([]);
  total = signal(0);
  loading = signal(true);
  loadingMore = signal(false);
  importing = signal(false);
  toast = signal<string | null>(null);
  detail = signal<Vocabulary | null>(null);
  kanji = signal<Kanjax | null>(null);
  relatedMap = signal<
    Record<number, { mangas: VocabularyManga[]; books: VocabularyBook[] }>
  >({});

  readonly orderOptions = [
    { value: 'word' as const, label: 'Palavra' },
    { value: 'appears' as const, label: 'Frequência' },
    { value: 'favorite' as const, label: 'Favorito' }
  ];

  private offset = 0;
  private hasMore = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private querySub: { unsubscribe: () => void } | null = null;

  constructor() {
    effect(() => {
      // React to header filter changes
      this.ui.search();
      this.ui.favoriteOnly();
      this.ui.order();
      this.ui.desc();
      this.ui.reloadToken();
      this.ui.mangaId();
      this.ui.bookId();
      void this.reload();
    });
  }

  ngOnInit(): void {
    this.querySub = this.route.queryParamMap.subscribe(params => {
      const mangaId = params.get('mangaId');
      const bookId = params.get('bookId');
      void this.applyScopeFromQuery(
        mangaId ? Number(mangaId) : null,
        bookId ? Number(bookId) : null
      );
    });
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private async applyScopeFromQuery(mangaId: number | null, bookId: number | null): Promise<void> {
    let title: string | null = null;
    if (mangaId && !Number.isNaN(mangaId)) {
      const m = await this.electron.getManga(mangaId);
      title = m?.title || m?.name || null;
      this.ui.setScope({ mangaId, bookId: null, title });
    } else if (bookId && !Number.isNaN(bookId)) {
      const b = await this.electron.getBook(bookId);
      title = b?.title || b?.name || null;
      this.ui.setScope({ mangaId: null, bookId, title });
    } else {
      this.ui.clearScope();
    }
  }

  clearScope(): void {
    void this.router.navigate(['/vocabulary']);
  }

  selectOrder(order: 'word' | 'appears' | 'favorite'): void {
    this.ui.setOrder(order);
    this.ui.showOrderPopup.set(false);
  }

  toggleSortDir(): void {
    this.ui.desc.update(v => !v);
    this.ui.showOrderPopup.set(false);
  }

  async reload(): Promise<void> {
    this.offset = 0;
    this.loading.set(true);
    try {
      const page = await this.electron.searchVocabulary({
        query: this.ui.search(),
        favoriteOnly: this.ui.favoriteOnly(),
        order: this.ui.order(),
        desc: this.ui.desc(),
        offset: 0,
        limit: PAGE_SIZE,
        mangaId: this.ui.mangaId(),
        bookId: this.ui.bookId()
      });
      this.items.set(page.items);
      this.total.set(page.total);
      this.hasMore = page.hasMore;
      this.offset = page.items.length;
      await this.enrichRelated(page.items);
    } catch (e) {
      console.warn('[vocabulary] search failed', e);
      this.items.set([]);
      this.total.set(0);
      this.hasMore = false;
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.hasMore || this.loadingMore() || this.loading()) return;
    this.loadingMore.set(true);
    try {
      const page = await this.electron.searchVocabulary({
        query: this.ui.search(),
        favoriteOnly: this.ui.favoriteOnly(),
        order: this.ui.order(),
        desc: this.ui.desc(),
        offset: this.offset,
        limit: PAGE_SIZE,
        mangaId: this.ui.mangaId(),
        bookId: this.ui.bookId()
      });
      this.items.update(list => [...list, ...page.items]);
      this.hasMore = page.hasMore;
      this.offset += page.items.length;
      await this.enrichRelated(page.items);
    } finally {
      this.loadingMore.set(false);
    }
  }

  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      void this.loadMore();
    }
  }

  private async enrichRelated(items: Vocabulary[]): Promise<void> {
    if (!this.ui.isScoped() && items.length === 0) return;
    // Load related covers for scoped view (and optionally global first page)
    const map = { ...this.relatedMap() };
    const hint = this.ui.scopeTitle();
    await Promise.all(
      items.slice(0, 40).map(async item => {
        if (!item.id || map[item.id]) return;
        const related = await this.electron.getVocabularyRelated(item.id, hint);
        map[item.id] = {
          mangas: related.mangas as VocabularyManga[],
          books: related.books as VocabularyBook[]
        };
      })
    );
    this.relatedMap.set(map);
  }

  onFavoriteChanged(item: Vocabulary): void {
    this.items.update(list =>
      list.map(v => (v.id === item.id ? { ...v, favorite: item.favorite } : v))
    );
  }

  relatedFor(item: Vocabulary): { mangas: VocabularyManga[]; books: VocabularyBook[] } {
    if (!item.id) return { mangas: [], books: [] };
    return this.relatedMap()[item.id] || { mangas: [], books: [] };
  }

  onOpenKanji(k: Kanjax): void {
    this.kanji.set(k);
  }

  focusRelated(kind: 'manga' | 'book', item: Vocabulary): void {
    if (!item.id) return;
    const related = this.relatedMap()[item.id];
    if (kind === 'manga') {
      const first = related?.mangas?.[0];
      if (first?.fkManga) {
        void this.router.navigate(['/vocabulary'], { queryParams: { mangaId: first.fkManga } });
        return;
      }
      this.showToast('Nenhum mangá vinculado a esta palavra');
    } else {
      const first = related?.books?.[0];
      if (first?.fkBook) {
        void this.router.navigate(['/vocabulary'], { queryParams: { bookId: first.fkBook } });
        return;
      }
      this.showToast('Nenhum livro vinculado a esta palavra');
    }
  }

  async importScoped(): Promise<void> {
    const mangaId = this.ui.mangaId();
    const bookId = this.ui.bookId();
    this.importing.set(true);
    try {
      const result = mangaId != null
        ? await this.electron.importMangaVocabulary(mangaId, true)
        : bookId != null
          ? await this.electron.importBookVocabulary(bookId, true)
          : { ok: false, linked: 0, message: 'Escopo inválido' };
      this.showToast(result.message || (result.ok ? 'Importação concluída' : 'Falha na importação'));
      if (result.ok) void this.reload();
    } finally {
      this.importing.set(false);
    }
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}
