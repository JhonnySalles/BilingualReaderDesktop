import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DetailService } from '../../core/services/detail.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { Manga } from '../../core/models';
import { DetailActionBarComponent } from './components/detail-action-bar.component';
import { DetailMetaSectionComponent, DetailMetaField } from './components/detail-meta-section.component';
import { DetailBookmarkDialogComponent } from './components/detail-bookmark-dialog.component';
import { DetailChaptersListComponent, DetailChapterItem } from './components/detail-chapters-list.component';

@Component({
  selector: 'app-manga-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DetailActionBarComponent,
    DetailMetaSectionComponent,
    DetailBookmarkDialogComponent,
    DetailChaptersListComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none">
      <div class="h-14 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" (click)="goBack()" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="min-w-0">
            <h1 class="text-base font-bold truncate">{{ manga()?.title || 'Detalhe do Mangá' }}</h1>
            <p class="text-[10px] text-slate-400">Mangá / Comic</p>
          </div>
        </div>
        <button type="button" (click)="openReader()"
          class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          [disabled]="!manga()">
          Abrir
        </button>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center text-sm text-slate-400 animate-pulse">Carregando…</div>
      } @else if (!manga()) {
        <div class="flex-1 flex items-center justify-center text-sm text-slate-400">Item não encontrado.</div>
      } @else {
        <div class="flex-1 min-h-0 overflow-y-auto">
          <!-- Hero -->
          <div class="relative overflow-hidden border-b border-slate-800">
            @if (manga()!.coverPath) {
              <div class="absolute inset-0 opacity-30 blur-2xl scale-110"
                [style.backgroundImage]="'url(local-cover:///' + manga()!.coverPath + ')'"
                style="background-size: cover; background-position: center;"></div>
            }
            <div class="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 opacity-80"></div>

            <div class="relative px-6 py-8 flex flex-col md:flex-row gap-6">
              <div class="w-40 shrink-0">
                <div class="aspect-[2/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
                  @if (manga()!.coverPath) {
                    <img [src]="'local-cover:///' + manga()!.coverPath" [alt]="manga()!.title" class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">Sem capa</div>
                  }
                </div>
              </div>

              <div class="flex-1 min-w-0 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-2xl font-extrabold text-white">{{ manga()!.title }}</h2>
                  @if (manga()!.excluded) {
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500 text-slate-950">Excluído</span>
                  }
                  @if (manga()!.favorite) {
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-slate-950">Favorito</span>
                  }
                </div>
                <p class="text-sm text-slate-300">{{ manga()!.series || manga()!.author || 'Sem série' }}</p>

                <div class="max-w-md space-y-1">
                  <div class="flex justify-between text-[11px] text-slate-400">
                    <span>Pág. {{ manga()!.bookMark }} / {{ manga()!.pages }}</span>
                    <span>{{ progress() }}%</span>
                  </div>
                  <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" [style.width.%]="progress()"></div>
                  </div>
                </div>

                <div class="text-xs text-slate-400 space-y-1">
                  <p class="truncate" [title]="manga()!.path">{{ manga()!.path }}</p>
                  <p>Último acesso: {{ lastAccess() }}</p>
                  <p>Tipo: {{ manga()!.fileType }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="p-6 space-y-8">
            <app-detail-action-bar
              accent="indigo"
              [isFavorite]="manga()!.favorite"
              (favoriteToggle)="onFavorite()"
              (markRead)="onMarkRead()"
              (clearProgress)="onClearProgress()"
              (bookmark)="showBookmark.set(true)"
              (vocabulary)="goVocabulary()"
              (deleteItem)="onDelete()" />

            <app-detail-meta-section title="Detalhe" [fields]="metaFields()" />

            <app-detail-chapters-list [chapters]="chapters()" (select)="onChapter($event)" />
          </div>
        </div>
      }

      <app-detail-bookmark-dialog
        accent="indigo"
        [open]="showBookmark()"
        [maxPages]="manga()?.pages || 1"
        [pageValue]="bookmarkPage()"
        (confirm)="onBookmarkSave($event)"
        (cancel)="showBookmark.set(false)" />
    </div>
  `
})
export class MangaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private detail = inject(DetailService);
  private nav = inject(NavigationStackService);

  manga = signal<Manga | null>(null);
  loading = signal(true);
  showBookmark = signal(false);
  bookmarkPage = signal(0);

  progress = computed(() => {
    const m = this.manga();
    if (!m) return 0;
    return this.detail.progressPercent(m.bookMark, m.pages);
  });

  lastAccess = computed(() => this.detail.formatLastAccess(this.manga()?.lastAccess));

  metaFields = computed<DetailMetaField[]>(() => {
    const m = this.manga();
    if (!m) return [];
    const fields: DetailMetaField[] = [];
    if (m.series) fields.push({ label: 'Série', value: m.series });
    if (m.author) fields.push({ label: 'Autores', value: m.author });
    if (m.volume) fields.push({ label: 'Volume', value: m.volume });
    if (m.release) fields.push({ label: 'Lançamento', value: m.release });
    if (m.publisher) fields.push({ label: 'Editora', value: m.publisher });
    if (m.genre) fields.push({ label: 'Gênero', value: m.genre });
    return fields;
  });

  chapters = computed<DetailChapterItem[]>(() => {
    const m = this.manga();
    if (!m?.chapters?.length) return [];
    return m.chapters.map((ch, index) => {
      const key = String(ch);
      const pageFromMap = m.chaptersPages?.[ch] ?? m.chaptersPages?.[key as any];
      const page = typeof pageFromMap === 'number'
        ? pageFromMap
        : (typeof pageFromMap === 'string' ? parseInt(pageFromMap, 10) || ch : ch);
      return {
        index,
        label: `Capítulo ${index + 1}`,
        page: Number.isFinite(page) ? page : 0
      };
    });
  });

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.loading.set(false);
      return;
    }
    try {
      const manga = await this.detail.loadManga(id);
      this.manga.set(manga);
      this.bookmarkPage.set(manga?.bookMark ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.nav.goBack(this.router);
  }

  openReader(): void {
    const m = this.manga();
    if (!m?.id) return;
    this.nav.openReader(this.router, 'image', m.id);
  }

  goVocabulary(): void {
    this.router.navigate(['/vocabulary']);
  }

  async onFavorite(): Promise<void> {
    const m = this.manga();
    if (!m) return;
    const updated = await this.detail.toggleFavoriteManga(m);
    if (updated) this.manga.set(updated);
  }

  async onMarkRead(): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const updated = await this.detail.markMangaRead(m.id);
    if (updated) {
      this.manga.set(updated);
      this.bookmarkPage.set(updated.bookMark);
    }
  }

  async onClearProgress(): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const updated = await this.detail.clearMangaProgress(m.id);
    if (updated) {
      this.manga.set(updated);
      this.bookmarkPage.set(0);
    }
  }

  async onBookmarkSave(page: number): Promise<void> {
    const m = this.manga();
    if (!m) return;
    const updated = await this.detail.setMangaBookMark(m, page);
    if (updated) {
      this.manga.set(updated);
      this.bookmarkPage.set(updated.bookMark);
    }
    this.showBookmark.set(false);
  }

  async onDelete(): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    if (!confirm(`Excluir "${m.title}" da biblioteca?`)) return;
    const ok = await this.detail.deleteManga(m.id);
    if (ok) this.nav.goToLibrary(this.router);
  }

  async onChapter(ch: DetailChapterItem): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const updated = await this.detail.setMangaBookMark(m, ch.page);
    if (updated) this.manga.set(updated);
    this.nav.openReader(this.router, 'image', m.id);
  }
}
