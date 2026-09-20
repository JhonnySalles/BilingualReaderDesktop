import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService, OpenFileLinkResult } from '../../../core/services/electron.service';
import {
  LinkedFile,
  LinkedPage
} from '../../../core/models/entities/linked-file.model';
import { Languages, Manga } from '../../../core/models';
import { PageLinkSlot } from '../../../core/models/enums/page-link-enums';
import { PageLinkEngine } from './page-link-engine';
import { PageSlotMenuAction, PagesLinkRowComponent } from './pages-link-row.component';
import { MangaFilePickerComponent } from './manga-file-picker.component';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-pages-link-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, PagesLinkRowComponent, MangaFilePickerComponent],
  template: `
    <div
      class="absolute inset-0 z-[70] flex flex-col bg-slate-950/95 backdrop-blur-md"
      (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 shrink-0 bg-slate-950/80">
        <!-- Left: Back & Manga Info -->
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" (click)="onClose()"
            class="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors" title="Fechar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Vincular páginas</span>
              <span class="text-slate-600 text-xs">•</span>
              <select
                class="bg-slate-900 border border-slate-700 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                [ngModel]="language()"
                (ngModelChange)="onLanguage($event)"
                title="Idioma do arquivo vinculado">
                <option [ngValue]="Languages.PORTUGUESE">PT</option>
                <option [ngValue]="Languages.ENGLISH">EN</option>
                <option [ngValue]="Languages.JAPANESE">JA</option>
              </select>
            </div>
            <h2 class="text-xs font-bold text-slate-100 truncate max-w-[180px] sm:max-w-xs md:max-w-sm" [title]="mangaTitle">
              {{ mangaTitle }}
            </h2>
          </div>
        </div>

        <!-- Center: Linked File Info -->
        <div class="flex items-center gap-2 min-w-0 max-w-md px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-300 shadow-inner">
          <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span class="truncate font-medium flex-1" [title]="linkedFileName() || 'Nenhum arquivo vinculado'">
            {{ linkedFileName() || 'Nenhum arquivo vinculado' }}
          </span>
          @if (engine.linkedFile.pages) {
            <span class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {{ engine.linkedFile.pages }} pág.
            </span>
          }
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" (click)="openLibraryPicker()"
            class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
            [disabled]="busy()">
            Biblioteca
          </button>
          <button type="button" (click)="pickNewFile()"
            class="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
            [disabled]="busy()">
            Novo arquivo
          </button>
          <button type="button" (click)="save()"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-40 shadow-sm transition-colors"
            [disabled]="busy() || !engine.hasLinkedFile">
            Salvar
          </button>
          <button type="button" (click)="reload()"
            class="p-1.5 rounded-xl text-slate-300 hover:bg-slate-800 cursor-pointer disabled:opacity-40 transition-colors"
            title="Recarregar" [disabled]="busy()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <button type="button" (click)="deleteLink()"
            class="p-1.5 rounded-xl text-rose-300 hover:bg-rose-500/10 cursor-pointer disabled:opacity-40 transition-colors"
            title="Excluir vínculo" [disabled]="busy() || !engine.hasLinkedFile">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      @if (status()) {
        <div class="px-4 py-1 text-center text-[11px] bg-slate-900/50 border-b border-slate-800"
          [class.text-rose-400]="statusError()" [class.text-slate-400]="!statusError()">
          {{ status() }}
        </div>
      }

      <!-- Main Workspace: Central List & Right Panel for Unlinked Pages -->
      <div class="flex-1 flex flex-row min-h-0 overflow-hidden">
        
        <!-- Central Linked list -->
        <div
          #listEl
          class="flex-1 overflow-y-auto px-4 py-4"
          (dragover)="onListDragOver($event)">
          <div class="max-w-4xl xl:max-w-5xl mx-auto w-full space-y-3">
            @if (busy() && pagesLink().length === 0) {
              <p class="text-xs text-slate-400 py-10 text-center">Preparando páginas…</p>
            } @else {
              @for (page of pagesLink(); track trackLinked(page, $index); let i = $index) {
                <app-pages-link-row
                  [page]="page"
                  [index]="i"
                  (dragPayload)="onRowDragStart($event)"
                  (dropPayload)="onRowDrop($event)"
                  (menuAction)="onMenuAction($event)"
                  (preview)="openPreview($event)"
                  (imageMeasured)="onImageMeasured($event)" />
              }
            }
          </div>
        </div>

        <!-- Right Side Panel: Unlinked strip / pages -->
        <div
          class="w-72 lg:w-80 shrink-0 border-l border-slate-800 bg-slate-950/60 flex flex-col transition-all duration-200"
          [class.ring-2]="notLinkedDropActive()"
          [class.ring-inset]="notLinkedDropActive()"
          [class.ring-indigo-500]="notLinkedDropActive()"
          [class.bg-slate-900]="notLinkedDropActive()"
          (dragover)="onNotLinkedDragOver($event)"
          (dragleave)="notLinkedDropActive.set(false)"
          (drop)="onDropToNotLinked($event)">
          <div class="p-3 border-b border-slate-800 flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Sem vínculo ({{ pagesNotLink().length }})
            </span>
          </div>
          <div class="flex-1 overflow-y-auto p-3">
            @if (pagesNotLink().length === 0) {
              <div class="h-full min-h-[120px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl">
                <svg class="w-8 h-8 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-xs text-slate-500">
                  Arraste páginas extras para cá
                </p>
              </div>
            } @else {
              <div class="flex flex-wrap gap-2.5">
                @for (p of pagesNotLink(); track trackNotLinked(p, $index); let i = $index) {
                  <div
                    class="relative w-20 shrink-0 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-400/80 bg-slate-950 cursor-grab active:cursor-grabbing transition-all hover:scale-105 shadow-md group"
                    draggable="true"
                    (dragstart)="onNotLinkedDragStart($event, i, p)">
                    @if (p.imageLeftFileLinkPage) {
                      <img [src]="p.imageLeftFileLinkPage" class="w-full h-28 object-contain bg-black/40 pointer-events-none" draggable="false" />
                    } @else {
                      <div class="h-28 flex items-center justify-center text-[10px] text-slate-600">?</div>
                    }
                    <span class="absolute bottom-1 left-1 px-1 rounded text-[9px] font-bold bg-black/75 text-slate-200">
                      {{ p.fileLinkLeftPage + 1 }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

      </div>

      <!-- Footer actions -->
      <div class="shrink-0 border-t border-slate-800 px-4 py-2.5 flex items-center justify-start gap-2 bg-slate-950/90">
        <button type="button" class="action-btn" (click)="applyEnginePrefs(); engine.autoReorderDoublePages(true); refresh()"
          [disabled]="!engine.hasLinkedFile">Auto</button>
        <button type="button" class="action-btn" (click)="engine.reorderBySortPages(); refresh()"
          [disabled]="!engine.hasLinkedFile">Reordenar</button>
        <button type="button" class="action-btn" (click)="engine.reorderSimplePages(); refresh()"
          [disabled]="!engine.hasLinkedFile">Simples</button>
        <button type="button" class="action-btn" (click)="reorderDoublePages(); refresh()"
          [disabled]="!engine.hasLinkedFile">Duplas</button>
        <button type="button" class="action-btn" (click)="engine.returnBackup(); refresh()"
          [disabled]="!engine.hasBackup">Desfazer</button>
      </div>

      @if (showPicker()) {
        <app-manga-file-picker
          [mangas]="libraryMangas()"
          [loading]="pickerLoading()"
          [excludePath]="mangaPath"
          (close)="showPicker.set(false)"
          (select)="onLibrarySelect($event)" />
      }

      @if (previewUrl()) {
        <div class="absolute inset-0 z-[85] flex flex-col bg-black/80 backdrop-blur-sm"
          (click)="previewUrl.set(null)">
          <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
            <button type="button" class="p-2 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
              (click)="previewUrl.set(null)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <p class="text-xs text-slate-300">{{ previewLabel() }}</p>
          </div>
          <div class="flex-1 flex items-center justify-center p-4 overflow-auto" (click)="$event.stopPropagation()">
            <img [src]="previewUrl()!" class="max-w-full max-h-full object-contain rounded-lg" alt="Preview" />
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .action-btn {
      padding: 0.4rem 0.75rem;
      border-radius: 0.75rem;
      font-size: 0.7rem;
      font-weight: 600;
      background: rgb(30 41 59);
      color: rgb(226 232 240);
      cursor: pointer;
      border: 1px solid rgb(51 65 85);
    }
    .action-btn:hover:not(:disabled) { background: rgb(51 65 85); }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class PagesLinkOverlayComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) mangaId = 0;
  @Input() mangaTitle = '';
  @Input() mangaPath = '';
  @Input() pageCount = 0;
  @Input() pages: string[] = [];
  @Input() pageNames: string[] = [];
  @Input() pagePaths: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<LinkedFile | null>();

  @ViewChild('listEl') listEl?: ElementRef<HTMLElement>;

  private electron = inject(ElectronService);
  private settings = inject(SettingsService);

  readonly Languages = Languages;
  readonly engine = new PageLinkEngine();

  pagesLink = signal<LinkedPage[]>([]);
  pagesNotLink = signal<LinkedPage[]>([]);
  language = signal<Languages>(Languages.PORTUGUESE);
  linkedFileName = signal('');
  busy = signal(false);
  status = signal('');
  statusError = signal(false);
  showPicker = signal(false);
  pickerLoading = signal(false);
  libraryMangas = signal<Manga[]>([]);
  previewUrl = signal<string | null>(null);
  previewLabel = signal('');
  notLinkedDropActive = signal(false);

  private dragState: { index: number; type: PageLinkSlot; kind: 'linked' | 'not-linked' } | null = null;
  private linkedSessionId: string | null = null;
  private initialized = false;

  applyEnginePrefs(): void {
    this.engine.usePagePathForLinked = this.settings.mangaUsePagePathForLinked();
  }

  reorderDoublePages(initial?: LinkedPage | null): void {
    this.applyEnginePrefs();
    this.engine.reorderDoublePages(this.settings.mangaDualPageCalculate(), initial);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mangaId'] || changes['pages']) {
      void this.bootstrap();
    }
  }

  ngOnDestroy(): void {
    void this.closeLinkedSession();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(ev: Event): void {
    if (this.previewUrl()) {
      ev.preventDefault();
      this.previewUrl.set(null);
      return;
    }
    if (this.showPicker()) {
      ev.preventDefault();
      this.showPicker.set(false);
      return;
    }
    ev.preventDefault();
    this.onClose();
  }

  trackLinked(page: LinkedPage, index: number): string {
    return `l-${page.mangaPage}-${index}-${page.fileLinkLeftPage}-${page.fileLinkRightPage}`;
  }

  trackNotLinked(page: LinkedPage, index: number): string {
    return `n-${page.fileLinkLeftPage}-${index}`;
  }

  refresh(): void {
    this.pagesLink.set([...this.engine.pagesLink]);
    this.pagesNotLink.set([...this.engine.pagesNotLink]);
    this.language.set(this.engine.language);
    this.linkedFileName.set(this.engine.linkedFile.name || '');
  }

  onClose(): void {
    this.close.emit();
  }

  onLanguage(lang: Languages): void {
    this.engine.setLanguage(lang);
    this.language.set(lang);
  }

  async openLibraryPicker(): Promise<void> {
    this.showPicker.set(true);
    this.pickerLoading.set(true);
    try {
      this.libraryMangas.set(await this.electron.listMangas());
    } catch {
      this.libraryMangas.set([]);
    } finally {
      this.pickerLoading.set(false);
    }
  }

  async onLibrarySelect(manga: Manga): Promise<void> {
    this.showPicker.set(false);
    if (!manga.path) return;
    await this.loadLinkedFile(manga.path);
  }

  async pickNewFile(): Promise<void> {
    const path = await this.electron.openMangaFile();
    if (!path) return;
    await this.loadLinkedFile(path);
  }

  async save(): Promise<void> {
    if (!this.engine.hasLinkedFile) return;
    this.busy.set(true);
    this.setStatus('Salvando…');
    try {
      const payload = this.engine.toPersistable();
      const saved = await this.electron.saveFileLink(payload);
      if (saved) {
        this.engine.linkedFile.id = saved.id;
        this.setStatus('Vínculo salvo');
        this.saved.emit(saved);
      } else {
        this.setStatus('Falha ao salvar', true);
      }
    } catch (e: any) {
      this.setStatus(e?.message || 'Erro ao salvar', true);
    } finally {
      this.busy.set(false);
    }
  }

  async reload(): Promise<void> {
    await this.bootstrap(true);
  }

  async deleteLink(): Promise<void> {
    this.busy.set(true);
    try {
      await this.electron.deleteFileLink(this.mangaId);
      await this.closeLinkedSession();
      this.engine.clearFileLink();
      this.refresh();
      this.setStatus('Vínculo removido');
      this.saved.emit(null);
    } catch (e: any) {
      this.setStatus(e?.message || 'Erro ao excluir', true);
    } finally {
      this.busy.set(false);
    }
  }

  onRowDragStart(payload: { index: number; type: PageLinkSlot; page: LinkedPage }): void {
    this.dragState = { index: payload.index, type: payload.type, kind: 'linked' };
  }

  onNotLinkedDragStart(ev: DragEvent, index: number, _page: LinkedPage): void {
    if (!ev.dataTransfer) return;
    this.dragState = { index, type: PageLinkSlot.NOT_LINKED, kind: 'not-linked' };
    ev.dataTransfer.setData('application/x-page-link', JSON.stringify({
      index,
      type: PageLinkSlot.NOT_LINKED,
      kind: 'not-linked'
    }));
    ev.dataTransfer.effectAllowed = 'move';
  }

  onNotLinkedDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.notLinkedDropActive.set(true);
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onDropToNotLinked(ev: DragEvent): void {
    ev.preventDefault();
    this.notLinkedDropActive.set(false);
    const state = this.readDrag(ev) || this.dragState;
    this.dragState = null;
    if (!state || state.kind !== 'linked') return;
    const origin = this.engine.pagesLink[state.index];
    if (!origin) return;
    if (state.type === PageLinkSlot.DUAL_PAGE) {
      this.engine.addNotLinkedFromSlot(origin, true);
    } else {
      this.engine.onNotLinked(origin);
    }
    this.refresh();
  }

  onRowDrop(payload: { index: number; type: PageLinkSlot; page: LinkedPage }): void {
    const state = this.dragState;
    this.dragState = null;
    if (!state) return;

    const destiny = this.engine.pagesLink[payload.index];
    if (!destiny) return;

    if (state.kind === 'not-linked') {
      const origin = this.engine.pagesNotLink[state.index];
      if (!origin) return;
      if (payload.type === PageLinkSlot.DUAL_PAGE) {
        this.engine.onMoveDualPage(PageLinkSlot.NOT_LINKED, origin, PageLinkSlot.DUAL_PAGE, destiny);
      } else {
        this.engine.fromNotLinked(origin, destiny);
      }
      this.refresh();
      return;
    }

    const origin = this.engine.pagesLink[state.index];
    if (!origin || origin === destiny && state.type === payload.type) return;

    if (
      state.type === PageLinkSlot.DUAL_PAGE ||
      payload.type === PageLinkSlot.DUAL_PAGE
    ) {
      this.engine.onMoveDualPage(state.type, origin, payload.type, destiny);
    } else {
      this.engine.onMove(origin, destiny);
    }
    this.refresh();
  }

  onListDragOver(ev: DragEvent): void {
    const el = this.listEl?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const edge = 48;
    if (y < edge) el.scrollTop -= 18;
    else if (y > rect.height - edge) el.scrollTop += 18;
  }

  onMenuAction(ev: { page: LinkedPage; action: PageSlotMenuAction }): void {
    const { page, action } = ev;
    switch (action) {
      case 'return':
        this.engine.reorderReturnPages(page);
        break;
      case 'auto':
        this.engine.autoReorderFrom(page);
        break;
      case 'single':
        this.engine.reorderSimplePages(true, page);
        break;
      case 'dual':
        this.engine.reorderDoublePages(this.settings.mangaDualPageCalculate(), page);
        break;
      case 'from-not-linked':
        this.engine.reorderNotLinked(page);
        break;
      case 'to-not-linked-left':
        this.engine.addNotLinkedFromSlot(page, false);
        break;
      case 'to-not-linked-right':
        this.engine.addNotLinkedFromSlot(page, true);
        break;
    }
    this.refresh();
  }

  openPreview(ev: { url: string; label: string }): void {
    this.previewUrl.set(ev.url);
    this.previewLabel.set(ev.label);
  }

  onImageMeasured(ev: {
    page: LinkedPage;
    slot: 'manga' | 'left' | 'right';
    width: number;
    height: number;
  }): void {
    this.engine.markDualFromImage(ev.page, ev.slot, ev.width, ev.height);
  }

  private async bootstrap(force = false): Promise<void> {
    if (!this.mangaId || !this.pages.length) return;
    if (this.initialized && !force) return;
    this.initialized = true;
    this.busy.set(true);
    this.setStatus('Carregando…');
    try {
      this.applyEnginePrefs();
      this.engine.reset(this.mangaId, this.mangaTitle);
      this.engine.loadMangaSpine({
        pageCount: this.pageCount || this.pages.length,
        pages: this.pages,
        pageNames: this.pageNames.length ? this.pageNames : this.pages.map((_, i) => String(i)),
        pagePaths: this.pagePaths.length ? this.pagePaths : this.pages.map(() => '')
      });

      const saved = await this.electron.getFileLink(this.mangaId);
      if (saved?.path) {
        await this.loadLinkedFile(saved.path, saved);
      } else {
        this.refresh();
        this.setStatus('');
      }
    } catch (e: any) {
      this.setStatus(e?.message || 'Erro ao carregar', true);
      this.refresh();
    } finally {
      this.busy.set(false);
    }
  }

  private async loadLinkedFile(filePath: string, saved?: LinkedFile | null): Promise<void> {
    this.busy.set(true);
    this.setStatus('Abrindo arquivo vinculado…');
    try {
      await this.closeLinkedSession();
      const opened = await this.electron.openFileLink(filePath, this.mangaId);
      if (!opened) {
        this.setStatus('Não foi possível abrir o arquivo', true);
        return;
      }
      this.linkedSessionId = opened.sessionId;

      let mapping = saved;
      if (!mapping) {
        mapping = await this.electron.findFileLink(
          this.mangaId,
          opened.name,
          opened.pageCount
        );
      }

      const source = this.toSource(opened);
      if (mapping?.pagesLink?.length) {
        this.applyEnginePrefs();
        this.engine.applySavedLink(
          mapping,
          {
            pageCount: this.engine.pagesLink.length,
            pages: this.engine.pagesLink.map(p => p.imageMangaPage || ''),
            pageNames: this.engine.pagesLink.map(p => p.mangaPageName),
            pagePaths: this.engine.pagesLink.map(p => p.mangaPagePath)
          },
          source
        );
        this.engine.linkedFile.path = opened.path;
        this.engine.linkedFile.name = opened.name;
        this.engine.linkedFile.type = opened.type;
        this.engine.linkedFile.folder = opened.folder;
        this.engine.linkedFile.pages = opened.pageCount;
      } else {
        this.applyEnginePrefs();
        this.engine.readFileLink(source);
      }
      this.refresh();
      this.setStatus(`${opened.pageCount} páginas no arquivo vinculado`);
    } catch (e: any) {
      this.setStatus(e?.message || 'Erro ao abrir arquivo', true);
    } finally {
      this.busy.set(false);
    }
  }

  private toSource(opened: OpenFileLinkResult) {
    return {
      path: opened.path,
      name: opened.name,
      type: opened.type,
      folder: opened.folder,
      pageCount: opened.pageCount,
      pages: opened.pages,
      pageNames: opened.pageNames,
      pagePaths: opened.pagePaths
    };
  }

  private async closeLinkedSession(): Promise<void> {
    if (this.linkedSessionId) {
      try {
        await this.electron.closeFileLink(this.linkedSessionId);
      } catch {}
      this.linkedSessionId = null;
    }
  }

  private readDrag(ev: DragEvent): { index: number; type: PageLinkSlot; kind: 'linked' | 'not-linked' } | null {
    try {
      const raw = ev.dataTransfer?.getData('application/x-page-link');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private setStatus(msg: string, error = false): void {
    this.status.set(msg);
    this.statusError.set(error);
  }
}
