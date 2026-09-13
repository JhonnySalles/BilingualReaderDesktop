import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DetailService } from '../../core/services/detail.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { ElectronService } from '../../core/services/electron.service';
import { Manga, Track, ExternalTrackerMediaDetails, ExternalTrackerRelatedItem } from '../../core/models';
import { DetailActionBarComponent } from './components/detail-action-bar.component';
import { DetailMetaSectionComponent, DetailMetaField } from './components/detail-meta-section.component';
import { DetailChaptersListComponent, DetailChapterItem } from './components/detail-chapters-list.component';
import { DetailBookmarksListComponent, DetailBookmarkItem } from './components/detail-bookmarks-list.component';
import { DetailWebSectionComponent } from './components/detail-web-section.component';
import {
  LibraryBookmarkDialogComponent,
  LibraryBookmarkPayload
} from '../../shared/library-bookmark-dialog/library-bookmark-dialog.component';
import { TrackerConfigDialogComponent } from '../../shared/tracker-config-dialog/tracker-config-dialog.component';
import { TrackerSimpleDialogComponent } from '../../shared/tracker-simple-dialog/tracker-simple-dialog.component';
import { TrackerService } from '../../core/services/tracker.service';
import { fromReaderIndex } from '../../core/utils/reading-progress.util';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SettingsService } from '../../core/services/settings.service';
import { BookCover3dComponent } from '../../shared/book-cover-3d/book-cover-3d.component';
import { CoverViewerDialogComponent } from '../../shared/cover-viewer-dialog/cover-viewer-dialog.component';

@Component({
  selector: 'app-manga-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DetailActionBarComponent,
    DetailMetaSectionComponent,
    DetailBookmarksListComponent,
    DetailChaptersListComponent,
    DetailWebSectionComponent,
    LibraryBookmarkDialogComponent,
    TrackerConfigDialogComponent,
    TrackerSimpleDialogComponent,
    BookCover3dComponent,
    CoverViewerDialogComponent
  ],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none relative pt-20">
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
          <!-- Hero Section -->
          <div class="relative overflow-hidden border-b border-slate-800">
            @if (coverUrl()) {
              <div class="absolute inset-0 opacity-30 blur-2xl scale-110"
                [style.backgroundImage]="'url(' + coverUrl() + ')'"
                style="background-size: cover; background-position: center;"></div>
            }
            <div class="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 opacity-80"></div>

            <div class="relative px-6 py-8 flex flex-col md:flex-row gap-6">
              <div class="w-40 shrink-0">
                <div 
                  class="aspect-[2/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl cover-3d-host relative group"
                  (click)="onCoverClick()"
                  (mousedown)="onCoverMouseDown($event)"
                  (mousemove)="onCoverMouseMove($event)"
                  (mouseup)="onCoverMouseUp()"
                  (mouseleave)="onCoverMouseLeave()"
                  (contextmenu)="onCoverRightClick($event)">
                  @if (coverUrl() || cover3dUrl()) {
                    @if (settings.theme3dCoverInDetail()) {
                      <app-book-cover-3d 
                        [coverUrl]="cover3dUrl() || coverUrl()" 
                        [backCoverUrl]="backCover3dUrl()"
                        [isPopup]="false" 
                        [isFullCover]="isFullCover3d()"
                        class="absolute inset-0 z-10">
                      </app-book-cover-3d>
                    } @else {
                      <img [src]="coverUrl()!" [alt]="manga()!.title" class="cover-3d-face w-full h-full object-cover rounded-xl cursor-pointer" />
                    }
                    
                    @if (!settings.theme3dCoverInDetail()) {
                      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    }
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
            <!-- Action Bar -->
            <app-detail-action-bar
              accent="indigo"
              [isFavorite]="manga()!.favorite"
              (favoriteToggle)="onFavorite()"
              (markRead)="onMarkRead()"
              (clearProgress)="onClearProgress()"
              (bookmark)="showBookmark.set(true)"
              (vocabulary)="goVocabulary()"
              (importVocabulary)="onImportVocabulary()"
              (tracker)="onOpenTracker()"
              (deleteItem)="onDelete()" />

            <!-- Local Metadata Section -->
            <app-detail-meta-section
              title="Detalhe do Mangá"
              [fields]="metaFields()"
              [tags]="tagList()" />

            <!-- Web Sync Section (MyAnimeList / AniList) -->
            <app-detail-web-section
              [mediaDetails]="webDetails()"
              [loading]="loadingWeb()"
              (openLink)="onOpenExternalLink($event)"
              (searchManual)="onOpenTracker()"
              (openRelated)="onOpenRelated($event)" />

            <!-- Bookmarks / Annotations List -->
            @if (bookmarks().length > 0) {
              <app-detail-bookmarks-list
                [bookmarks]="bookmarks()"
                (select)="onBookmarkSelect($event)"
                (delete)="onBookmarkDelete($event)"
                (addBookmark)="showBookmark.set(true)" />
            }

            <!-- Chapters List -->
            <app-detail-chapters-list
              [chapters]="chapters()"
              (select)="onChapter($event)" />
          </div>
        </div>
      }

      <app-library-bookmark-dialog
        accent="indigo"
        type="manga"
        [filePath]="manga()?.path"
        [open]="showBookmark()"
        [title]="manga()?.title || ''"
        [maxPages]="manga()?.pages || 1"
        [pageValue]="bookmarkPage()"
        [lastAccess]="manga()?.lastAccess"
        [completed]="!!manga()?.completed"
        (confirm)="onBookmarkSave($event)"
        (cancel)="showBookmark.set(false)" />

      <app-tracker-simple-dialog
        [open]="showTrackerSimple()"
        [libraryId]="manga()?.fkLibrary || 0"
        [mediaTitle]="manga()?.title || ''"
        [mediaFilename]="manga()?.name || ''"
        (confirmed)="onTrackerSaved($event)"
        (cancel)="showTrackerSimple.set(false)"
        (openFullConfig)="onOpenFullConfigFromSimple($event)" />

      <app-tracker-config-dialog
        [open]="showTrackerConfig()"
        [track]="matchedTrack()"
        [fkLibrary]="manga()?.fkLibrary || 0"
        [initialTitle]="manga()?.title || manga()?.series || ''"
        [initialFilename]="manga()?.name || ''"
        (saved)="onTrackerConfigSaved($event)"
        (deleted)="onTrackerDeleted()"
        (cancel)="showTrackerConfig.set(false)" />

      @if (importMessage()) {
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 shadow-xl">
          {{ importMessage() }}
        </div>
      }

      <app-cover-viewer-dialog
        [open]="showCoverViewer()"
        [coverUrl]="cover3dUrl() || coverUrl()"
        [backCoverUrl]="backCover3dUrl()"
        [title]="manga()?.title || ''"
        [isFullCover]="isFullCover3d()"
        (cancel)="showCoverViewer.set(false)" />
    </div>
  `
})
export class MangaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private detail = inject(DetailService);
  private nav = inject(NavigationStackService);
  private electron = inject(ElectronService);
  private trackerService = inject(TrackerService);
  private confirmDialog = inject(ConfirmDialogService);
  settings = inject(SettingsService);

  manga = signal<Manga | null>(null);
  loading = signal(true);
  loadingWeb = signal(false);
  webDetails = signal<ExternalTrackerMediaDetails | null>(null);
  bookmarks = signal<DetailBookmarkItem[]>([]);
  showBookmark = signal(false);
  showTrackerSimple = signal(false);
  showTrackerConfig = signal(false);
  showCoverViewer = signal(false);
  matchedTrack = signal<Track | null>(null);
  bookmarkPage = signal(0);
  importMessage = signal<string | null>(null);

  cover3dUrl = signal<string | null>(null);
  backCover3dUrl = signal<string | null>(null);
  isFullCover3d = signal<boolean>(false);

  coverUrl = computed(() => {
    const path = this.manga()?.coverPath;
    if (!path) return null;
    return 'local-cover:///' + path.replace(/\\/g, '/');
  });

  progress = computed(() => {
    const m = this.manga();
    if (!m) return 0;
    return this.detail.progressPercent(m.bookMark, m.pages, m.completed);
  });

  lastAccess = computed(() => this.detail.formatLastAccess(this.manga()?.lastAccess));

  tagList = computed(() => this.detail.parseTags(this.manga()?.tags));

  metaFields = computed<DetailMetaField[]>(() => {
    const m = this.manga();
    if (!m) return [];
    const fields: DetailMetaField[] = [];
    if (m.series) fields.push({ label: 'Série', value: m.series });
    if (m.author) fields.push({ label: 'Autores', value: m.author });
    if (m.volume) fields.push({ label: 'Volume', value: m.volume });
    if (m.release) fields.push({ label: 'Lançamento', value: m.release });
    if (m.dateCreate) fields.push({ label: 'Publicado', value: this.formatDate(m.dateCreate) });
    if (m.language) fields.push({ label: 'Idioma', value: m.language });
    if (m.title) fields.push({ label: 'Título', value: m.title });
    if (m.storyArch) fields.push({ label: 'Arco da História', value: m.storyArch });
    if (m.genre) fields.push({ label: 'Gênero', value: m.genre });
    if (m.characters) fields.push({ label: 'Personagens', value: m.characters });
    if (m.publisher) fields.push({ label: 'Editora', value: m.publisher });
    return fields;
  });

  chapters = computed<DetailChapterItem[]>(() => {
    const m = this.manga();
    if (!m?.chapters?.length) return [];
    return m.chapters.map((ch, index) => {
      const key = String(ch);
      const titleRaw = m.chaptersPages?.[ch] ?? (m.chaptersPages as Record<string, string> | undefined)?.[key];
      const label =
        typeof titleRaw === 'string' && titleRaw.trim()
          ? titleRaw.trim()
          : `Capítulo ${index + 1}`;
      return {
        index,
        label,
        page: ch
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

      if (manga?.id) {
        await Promise.all([
          this.loadBookmarks(manga.id),
          this.loadWebTrackerDetails(manga),
          this.loadCover3D(manga.id)
        ]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCover3D(mangaId: number): Promise<void> {
    try {
      const res = await this.detail.loadMangaCover3D(mangaId);
      if (res) {
        this.isFullCover3d.set(!!res.isFullCover);
        if (res.fullCoverPath) {
          this.cover3dUrl.set('local-cover:///' + res.fullCoverPath.replace(/\\/g, '/'));
        } else if (res.frontCoverPath) {
          this.cover3dUrl.set('local-cover:///' + res.frontCoverPath.replace(/\\/g, '/'));
        }
        if (res.backCoverPath) {
          this.backCover3dUrl.set('local-cover:///' + res.backCoverPath.replace(/\\/g, '/'));
        }
      }
    } catch (e) {
      console.warn('[MangaDetailComponent] Erro ao carregar capa 3D:', e);
    }
  }

  private async loadBookmarks(mangaId: number): Promise<void> {
    try {
      const marks = await this.detail.loadMangaAnnotations(mangaId);
      this.bookmarks.set(
        (marks || []).map(m => ({
          id: m.id,
          page: m.page,
          pages: m.pages,
          note: m.note,
          chapter: m.chapter,
          type: m.markType,
          dateCreate: m.dateCreate
        }))
      );
    } catch (e) {
      console.warn('[MangaDetailComponent] Erro ao carregar bookmarks:', e);
    }
  }

  private async loadWebTrackerDetails(manga: Manga): Promise<void> {
    this.loadingWeb.set(true);
    try {
      let malId: number | null = null;
      let aniId: number | null = null;

      if (manga.fkLibrary) {
        const matchRes = await this.trackerService.matchTrack({
          libraryId: manga.fkLibrary,
          title: manga.title || '',
          filename: manga.name || '',
          comicInfoTitle: manga.title
        });
        if (matchRes?.track) {
          this.matchedTrack.set(matchRes.track);
          malId = matchRes.track.malId ?? null;
          aniId = matchRes.track.aniId ?? null;
        }
      }

      const searchTitle = manga.series || manga.title || manga.name;
      const details = await this.trackerService.getMediaDetails({
        malId,
        aniId,
        title: searchTitle
      });

      this.webDetails.set(details);
    } catch (e) {
      console.warn('[MangaDetailComponent] Erro ao sincronizar detalhes web:', e);
    } finally {
      this.loadingWeb.set(false);
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR');
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
    const m = this.manga();
    if (!m?.id) {
      this.router.navigate(['/vocabulary']);
      return;
    }
    this.router.navigate(['/vocabulary'], { queryParams: { mangaId: m.id } });
  }

  async onImportVocabulary(): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    this.importMessage.set('Importando vocabulário…');
    const result = await this.electron.importMangaVocabulary(m.id, true);
    this.importMessage.set(result.message || (result.ok ? 'Importação concluída' : 'Falha'));
    setTimeout(() => this.importMessage.set(null), 3500);
    if (result.ok) {
      const refreshed = await this.detail.loadManga(m.id);
      if (refreshed) this.manga.set(refreshed);
    }
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

  async onBookmarkSave(payload: LibraryBookmarkPayload): Promise<void> {
    const m = this.manga();
    if (!m) return;
    const updated = await this.detail.setMangaBookmarkEdit(m, payload);
    if (updated) {
      this.manga.set(updated);
      this.bookmarkPage.set(updated.bookMark);
      if (m.id) await this.loadBookmarks(m.id);
    }
    this.showBookmark.set(false);
  }

  async onBookmarkSelect(bm: DetailBookmarkItem): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const bookMark = fromReaderIndex(bm.page, m.pages || 1);
    const updated = await this.detail.setMangaBookMark(m, bookMark);
    if (updated) this.manga.set(updated);
    this.nav.openReader(this.router, 'image', m.id);
  }

  async onBookmarkDelete(bm: DetailBookmarkItem): Promise<void> {
    if (!bm.id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Excluir Marcador',
      message: `Deseja remover o marcador da página ${bm.page}?`,
      confirmText: 'Excluir',
      confirmVariant: 'danger'
    });
    if (!ok) return;

    await this.detail.deleteMangaAnnotation(bm.id);
    const m = this.manga();
    if (m?.id) {
      await this.loadBookmarks(m.id);
    }
  }

  async onDelete(): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Excluir da Biblioteca',
      message: `Deseja realmente excluir "${m.title || m.name}" da biblioteca?\n\nOs arquivos locais não serão apagados.`,
      confirmText: 'Excluir',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!ok) return;
    const okDelete = await this.detail.deleteManga(m.id);
    if (okDelete) this.nav.goToLibrary(this.router);
  }

  async onChapter(ch: DetailChapterItem): Promise<void> {
    const m = this.manga();
    if (!m?.id) return;
    const bookMark = fromReaderIndex(ch.page, m.pages || 1);
    const updated = await this.detail.setMangaBookMark(m, bookMark);
    if (updated) this.manga.set(updated);
    this.nav.openReader(this.router, 'image', m.id);
  }

  onOpenExternalLink(url: string): void {
    if (url) {
      this.electron.openExternal(url);
    }
  }

  onOpenRelated(item: ExternalTrackerRelatedItem): void {
    if (item.url) {
      this.electron.openExternal(item.url);
    }
  }

  async onOpenTracker(): Promise<void> {
    const m = this.manga();
    if (!m?.fkLibrary) return;
    this.showTrackerSimple.set(true);
  }

  onOpenFullConfigFromSimple(track: Track | null): void {
    this.matchedTrack.set(track);
    this.showTrackerSimple.set(false);
    this.showTrackerConfig.set(true);
  }

  async onTrackerSaved(track: Track): Promise<void> {
    this.matchedTrack.set(track);
    this.showTrackerSimple.set(false);
    this.importMessage.set('Rastreador sincronizado com sucesso!');
    setTimeout(() => this.importMessage.set(null), 3000);
    const m = this.manga();
    if (m) {
      await this.loadWebTrackerDetails(m);
    }
  }

  async onTrackerConfigSaved(track: Track): Promise<void> {
    this.matchedTrack.set(track);
    this.showTrackerConfig.set(false);
    this.showTrackerSimple.set(true);
    this.importMessage.set('Rastreador salvo com sucesso!');
    setTimeout(() => this.importMessage.set(null), 3000);
    const m = this.manga();
    if (m) {
      await this.loadWebTrackerDetails(m);
    }
  }

  onTrackerDeleted(): void {
    this.matchedTrack.set(null);
    this.showTrackerConfig.set(false);
    this.showTrackerSimple.set(false);
    this.importMessage.set('Rastreador removido.');
    setTimeout(() => this.importMessage.set(null), 3000);
    this.webDetails.set(null);
  }

  private longPressTimer: any = null;
  private pressStartX = 0;
  private pressStartY = 0;

  onCoverRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.showCoverViewer.set(true);
  }

  onCoverMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }

    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.showCoverViewer.set(true);
    }, 500);
  }

  onCoverMouseMove(event: MouseEvent): void {
    if (!this.longPressTimer) return;
    const dist = Math.hypot(event.clientX - this.pressStartX, event.clientY - this.pressStartY);
    if (dist > 8) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onCoverMouseUp(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onCoverMouseLeave(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onCoverClick(): void {
    if (!this.settings.theme3dCoverInDetail()) {
      this.showCoverViewer.set(true);
    }
  }
}
