import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectronService } from '../../core/services/electron.service';
import { NavigationStackService } from '../../core/services/navigation-stack.service';
import { Book } from '../../core/models';

@Component({
  selector: 'app-reader-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header class="h-14 px-6 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-20">
        <div class="flex items-center gap-3">
          <button type="button" (click)="goBack()" class="p-2 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 class="text-sm font-bold">{{ book()?.title || 'Leitor de Ebook EPUB' }}</h1>
            <p class="text-[10px] text-slate-400">ID do Livro: {{ bookId }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-2 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
            (click)="prevPage()"
            [disabled]="currentPage() <= 0">
            Anterior
          </button>
          <span class="text-xs text-slate-400 tabular-nums">
            Página {{ currentPage() + 1 }} de {{ totalPages() }}
          </span>
          <button
            type="button"
            class="px-2 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
            (click)="nextPage()"
            [disabled]="currentPage() >= totalPages() - 1">
            Próxima
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto flex items-center justify-center p-8">
        <div class="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          </div>
          <h2 class="text-lg font-bold text-slate-200 mb-2">Visualizador EPUB (epubjs)</h2>
          <p class="text-xs text-slate-400 leading-relaxed mb-6">
            Sessão de leitura sendo registrada para estatísticas. Avançar páginas atualiza o progresso.
          </p>
        </div>
      </main>
    </div>
  `
})
export class ReaderTextComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private electron = inject(ElectronService);
  private nav = inject(NavigationStackService);

  bookId = this.route.snapshot.paramMap.get('id');
  book = signal<Book | null>(null);
  currentPage = signal(0);
  totalPages = signal(1);

  private sessionId: number | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;

  async ngOnInit(): Promise<void> {
    const id = Number(this.bookId);
    if (!id || Number.isNaN(id)) return;

    const book = await this.electron.getBook(id);
    if (!book) return;

    this.book.set(book);
    const pages = Math.max(1, book.pages || 1);
    this.totalPages.set(pages);
    this.currentPage.set(Math.min(Math.max(0, book.bookMark || 0), pages - 1));

    this.sessionId = await this.electron.startHistorySession({
      fkLibrary: book.fkLibrary ?? 0,
      fkReference: book.id!,
      type: 'BOOK',
      pageStart: this.currentPage(),
      pages,
      volume: book.volume || ''
    });
  }

  ngOnDestroy(): void {
    void this.endSession();
  }

  prevPage(): void {
    if (this.currentPage() <= 0) return;
    this.currentPage.update(p => p - 1);
    this.scheduleProgressUpdate();
  }

  nextPage(): void {
    if (this.currentPage() >= this.totalPages() - 1) return;
    this.currentPage.update(p => p + 1);
    this.scheduleProgressUpdate();
  }

  async endSession(): Promise<void> {
    if (this.ended || this.sessionId == null) return;
    this.ended = true;
    if (this.updateTimer) clearTimeout(this.updateTimer);

    const book = this.book();
    await this.electron.endHistorySession({
      id: this.sessionId,
      pageEnd: this.currentPage(),
      pages: this.totalPages(),
      type: 'BOOK',
      fkReference: book?.id
    });
  }

  async goBack(): Promise<void> {
    await this.endSession();
    this.nav.goBack(this.router);
  }

  private scheduleProgressUpdate(): void {
    if (this.sessionId == null) return;
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      if (this.sessionId == null) return;
      void this.electron.updateHistorySession({
        id: this.sessionId,
        pageEnd: this.currentPage(),
        pages: this.totalPages()
      });
    }, 5000);
  }
}
