import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DetailService } from '../../core/services/detail.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { Book } from '../../core/models';
import { DetailActionBarComponent } from './components/detail-action-bar.component';
import { DetailMetaSectionComponent, DetailMetaField } from './components/detail-meta-section.component';
import { DetailBookmarkDialogComponent } from './components/detail-bookmark-dialog.component';

@Component({
  selector: 'app-book-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    DetailActionBarComponent,
    DetailMetaSectionComponent,
    DetailBookmarkDialogComponent
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
            <h1 class="text-base font-bold truncate">{{ book()?.title || 'Detalhe do Livro' }}</h1>
            <p class="text-[10px] text-slate-400">Livro / EPUB</p>
          </div>
        </div>
        <button type="button" (click)="openReader()"
          class="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
          [disabled]="!book()">
          Abrir
        </button>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center text-sm text-slate-400 animate-pulse">Carregando…</div>
      } @else if (!book()) {
        <div class="flex-1 flex items-center justify-center text-sm text-slate-400">Item não encontrado.</div>
      } @else {
        <div class="flex-1 min-h-0 overflow-y-auto">
          <div class="relative overflow-hidden border-b border-slate-800">
            @if (book()!.coverPath) {
              <div class="absolute inset-0 opacity-30 blur-2xl scale-110"
                [style.backgroundImage]="'url(local-cover:///' + book()!.coverPath + ')'"
                style="background-size: cover; background-position: center;"></div>
            }
            <div class="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 opacity-80"></div>

            <div class="relative px-6 py-8 flex flex-col md:flex-row gap-6">
              <div class="w-40 shrink-0">
                <div class="aspect-[2/3] rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
                  @if (book()!.coverPath) {
                    <img [src]="'local-cover:///' + book()!.coverPath" [alt]="book()!.title" class="w-full h-full object-cover" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-amber-500 text-xs">{{ book()!.fileType || 'EPUB' }}</div>
                  }
                </div>
              </div>

              <div class="flex-1 min-w-0 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-2xl font-extrabold text-white">{{ book()!.title }}</h2>
                  @if (book()!.excluded) {
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500 text-slate-950">Excluído</span>
                  }
                  @if (book()!.favorite) {
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-slate-950">Favorito</span>
                  }
                </div>
                <p class="text-sm text-slate-300">{{ book()!.author || 'Autor desconhecido' }}</p>

                <div class="max-w-md space-y-1">
                  <div class="flex justify-between text-[11px] text-slate-400">
                    <span>Pág. {{ book()!.bookMark }} / {{ book()!.pages }} ({{ progress() }}%)</span>
                  </div>
                  <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" [style.width.%]="progress()"></div>
                  </div>
                </div>

                <div class="text-xs text-slate-400 space-y-1">
                  <p class="truncate" [title]="book()!.path">{{ book()!.path }}</p>
                  <p>Último acesso: {{ lastAccess() }}</p>
                  <p>Tipo: {{ book()!.fileType || 'EPUB' }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="p-6 space-y-8">
            <app-detail-action-bar
              accent="amber"
              [isFavorite]="book()!.favorite"
              [showAddTag]="true"
              (favoriteToggle)="onFavorite()"
              (markRead)="onMarkRead()"
              (clearProgress)="onClearProgress()"
              (bookmark)="showBookmark.set(true)"
              (addTag)="showTagInput.set(true)"
              (vocabulary)="goVocabulary()"
              (deleteItem)="onDelete()" />

            <section class="space-y-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Idioma do livro</h3>
              <select
                class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 max-w-xs"
                [ngModel]="book()!.language || ''"
                (ngModelChange)="onLanguage($event)">
                <option value="">Não definido</option>
                <option value="PORTUGUESE">Português</option>
                <option value="ENGLISH">Inglês</option>
                <option value="JAPANESE">Japonês</option>
              </select>
            </section>

            <app-detail-meta-section title="Information" [fields]="metaFields()">
              <div class="mt-4 space-y-2">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tags</p>
                <div class="flex flex-wrap gap-2">
                  @for (tag of tagList(); track tag) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                      {{ tag }}
                      <button type="button" class="hover:text-white cursor-pointer" (click)="removeTag(tag)">×</button>
                    </span>
                  }
                  @if (tagList().length === 0) {
                    <span class="text-xs text-slate-500">Nenhuma tag</span>
                  }
                </div>
                @if (showTagInput()) {
                  <div class="flex gap-2 max-w-md mt-2">
                    <input
                      type="text"
                      class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                      placeholder="Nova tag"
                      [(ngModel)]="newTag"
                      (keydown.enter)="addTag()" />
                    <button type="button" (click)="addTag()"
                      class="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white cursor-pointer">
                      Add
                    </button>
                    <button type="button" (click)="showTagInput.set(false)"
                      class="px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer">
                      Fechar
                    </button>
                  </div>
                }
              </div>
            </app-detail-meta-section>
          </div>
        </div>
      }

      <app-detail-bookmark-dialog
        accent="amber"
        [open]="showBookmark()"
        [maxPages]="book()?.pages || 1"
        [pageValue]="bookmarkPage()"
        (confirm)="onBookmarkSave($event)"
        (cancel)="showBookmark.set(false)" />
    </div>
  `
})
export class BookDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private detail = inject(DetailService);
  private nav = inject(NavigationStackService);

  book = signal<Book | null>(null);
  loading = signal(true);
  showBookmark = signal(false);
  showTagInput = signal(false);
  bookmarkPage = signal(0);
  newTag = '';

  progress = computed(() => {
    const b = this.book();
    if (!b) return 0;
    return this.detail.progressPercent(b.bookMark, b.pages);
  });

  lastAccess = computed(() => this.detail.formatLastAccess(this.book()?.lastAccess));

  tagList = computed(() => this.detail.parseTags(this.book()?.tags));

  metaFields = computed<DetailMetaField[]>(() => {
    const b = this.book();
    if (!b) return [];
    const fields: DetailMetaField[] = [];
    if (b.title) fields.push({ label: 'Título', value: b.title });
    if (b.author) fields.push({ label: 'Autores', value: b.author });
    if (b.genre) fields.push({ label: 'Gêneros', value: b.genre });
    if (b.isbn) fields.push({ label: 'ISBN', value: b.isbn });
    if (b.language) fields.push({ label: 'Idioma', value: b.language });
    if (b.volume) fields.push({ label: 'Volume', value: b.volume });
    if (b.release) fields.push({ label: 'Lançamento', value: b.release });
    if (b.publisher) fields.push({ label: 'Editora', value: b.publisher });
    if (b.annotation) fields.push({ label: 'Anotação', value: b.annotation });
    if (b.path) fields.push({ label: 'Arquivo', value: b.path });
    return fields;
  });

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.loading.set(false);
      return;
    }
    try {
      const book = await this.detail.loadBook(id);
      this.book.set(book);
      this.bookmarkPage.set(book?.bookMark ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.nav.goBack(this.router);
  }

  openReader(): void {
    const b = this.book();
    if (!b?.id) return;
    this.nav.openReader(this.router, 'text', b.id);
  }

  goVocabulary(): void {
    this.router.navigate(['/vocabulary']);
  }

  async onFavorite(): Promise<void> {
    const b = this.book();
    if (!b) return;
    const updated = await this.detail.toggleFavoriteBook(b);
    if (updated) this.book.set(updated);
  }

  async onMarkRead(): Promise<void> {
    const b = this.book();
    if (!b?.id) return;
    const updated = await this.detail.markBookRead(b.id);
    if (updated) {
      this.book.set(updated);
      this.bookmarkPage.set(updated.bookMark);
    }
  }

  async onClearProgress(): Promise<void> {
    const b = this.book();
    if (!b?.id) return;
    const updated = await this.detail.clearBookProgress(b.id);
    if (updated) {
      this.book.set(updated);
      this.bookmarkPage.set(0);
    }
  }

  async onBookmarkSave(page: number): Promise<void> {
    const b = this.book();
    if (!b) return;
    const updated = await this.detail.setBookBookMark(b, page);
    if (updated) {
      this.book.set(updated);
      this.bookmarkPage.set(updated.bookMark);
    }
    this.showBookmark.set(false);
  }

  async onDelete(): Promise<void> {
    const b = this.book();
    if (!b?.id) return;
    if (!confirm(`Excluir "${b.title}" da biblioteca?`)) return;
    const ok = await this.detail.deleteBook(b.id);
    if (ok) this.nav.goToLibrary(this.router);
  }

  async onLanguage(language: string): Promise<void> {
    const b = this.book();
    if (!b) return;
    const updated = await this.detail.updateBookLanguage(b, language);
    if (updated) this.book.set(updated);
  }

  async addTag(): Promise<void> {
    const b = this.book();
    const tag = this.newTag.trim();
    if (!b || !tag) return;
    const tags = this.detail.parseTags(b.tags);
    if (!tags.includes(tag)) tags.push(tag);
    const updated = await this.detail.updateBookTags(b, this.detail.serializeTags(tags));
    if (updated) {
      this.book.set(updated);
      this.newTag = '';
    }
  }

  async removeTag(tag: string): Promise<void> {
    const b = this.book();
    if (!b) return;
    const tags = this.detail.parseTags(b.tags).filter(t => t !== tag);
    const updated = await this.detail.updateBookTags(b, this.detail.serializeTags(tags));
    if (updated) this.book.set(updated);
  }
}
