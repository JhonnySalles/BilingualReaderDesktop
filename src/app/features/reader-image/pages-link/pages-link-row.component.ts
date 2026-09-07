import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LinkedPage } from '../../../core/models/entities/linked-file.model';
import { PAGE_EMPTY, PageLinkSlot } from '../../../core/models/enums/page-link-enums';

export type PageSlotMenuAction =
  | 'return'
  | 'auto'
  | 'single'
  | 'dual'
  | 'from-not-linked'
  | 'to-not-linked-left'
  | 'to-not-linked-right';

@Component({
  selector: 'app-pages-link-row',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex items-stretch gap-2 p-2 rounded-xl bg-slate-900/70 border border-slate-800/50"
      [class.ring-2]="dropHighlight"
      [class.ring-indigo-500]="dropHighlight">
      <div class="flex flex-col items-center justify-center w-8 shrink-0">
        <span class="text-[10px] font-bold tabular-nums text-slate-400">{{ page.mangaPage + 1 }}</span>
      </div>

      <!-- Manga (anchor) -->
      <div class="relative w-16 sm:w-20 shrink-0 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/60">
        @if (page.imageMangaPage) {
          <img
            [src]="page.imageMangaPage"
            alt="Manga"
            class="w-full h-24 sm:h-28 object-cover"
            draggable="false"
            (load)="onImgLoad($event, 'manga')"
            (dblclick)="preview.emit({ url: page.imageMangaPage!, label: 'Mangá p.' + (page.mangaPage + 1) })" />
        } @else {
          <div class="h-24 sm:h-28 flex items-center justify-center text-[10px] text-slate-600">—</div>
        }
        @if (page.isMangaDualPage) {
          <span class="absolute top-1 left-1 px-1 rounded text-[8px] font-bold bg-amber-500/80 text-slate-950">DUP</span>
        }
      </div>

      <div class="flex items-center text-slate-600 shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>

      <!-- Left linked slot -->
      <div
        class="relative flex-1 min-w-0 rounded-lg overflow-hidden border transition-colors cursor-grab"
        [ngClass]="hasLeft
          ? 'border-slate-700 bg-slate-950'
          : 'border-dashed border-slate-600 bg-slate-900/40'"
        [attr.data-slot]="'LINKED'"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event, slotLinked)"
        draggable="true"
        (dragstart)="onDragStart($event, slotLinked)"
        (contextmenu)="openMenu($event, 'left')">
        @if (hasLeft) {
          <img
            [src]="page.imageLeftFileLinkPage || ''"
            alt="Vinculada"
            class="w-full h-24 sm:h-28 object-cover pointer-events-none"
            draggable="false"
            (load)="onImgLoad($event, 'left')" />
          <span class="absolute bottom-1 left-1 px-1 rounded text-[8px] font-semibold bg-black/60 text-slate-200">
            {{ page.fileLinkLeftPage + 1 }}
          </span>
          @if (page.isFileLeftDualPage) {
            <span class="absolute top-1 left-1 px-1 rounded text-[8px] font-bold bg-indigo-500/80 text-white">DUP</span>
          }
        } @else {
          <div class="h-24 sm:h-28 flex items-center justify-center text-[10px] text-slate-500">Soltar</div>
        }
        <button
          type="button"
          class="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-slate-300 hover:text-white cursor-pointer opacity-80 hover:opacity-100"
          title="Menu"
          (click)="openMenu($event, 'left')">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>

      <!-- Right / dual slot -->
      <div
        class="relative w-16 sm:w-20 shrink-0 rounded-lg overflow-hidden border transition-colors"
        [ngClass]="hasRight
          ? 'border-slate-700 bg-slate-950 cursor-grab'
          : 'border-dashed border-slate-600 bg-slate-900/40'"
        [attr.data-slot]="'DUAL_PAGE'"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event, slotDual)"
        [attr.draggable]="hasRight ? 'true' : 'false'"
        (dragstart)="onDualDragStart($event)"
        (contextmenu)="onDualContextMenu($event)">
        @if (hasRight) {
          <img
            [src]="page.imageRightFileLinkPage"
            alt="Dual"
            class="w-full h-24 sm:h-28 object-cover pointer-events-none"
            draggable="false"
            (load)="onImgLoad($event, 'right')" />
          <span class="absolute bottom-1 left-1 px-1 rounded text-[8px] font-semibold bg-black/60 text-slate-200">
            {{ page.fileLinkRightPage + 1 }}
          </span>
        } @else {
          <div class="h-24 sm:h-28 flex flex-col items-center justify-center gap-0.5 text-[10px] text-slate-500">
            <span class="text-lg leading-none text-slate-600">+</span>
            <span>Dual</span>
          </div>
        }
      </div>
    </div>

    @if (menuOpen) {
      <div class="fixed inset-0 z-[90]" (click)="closeMenu()" (contextmenu)="onBackdropContext($event)"></div>
      <div
        class="fixed z-[91] min-w-[12rem] rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl py-1"
        [style.left.px]="menuX"
        [style.top.px]="menuY">
        <button type="button" class="menu-item" (click)="emitAction('return')">Preencher vazios</button>
        <button type="button" class="menu-item" (click)="emitAction('auto')">Auto nesta página</button>
        <button type="button" class="menu-item" (click)="emitAction('single')">Páginas simples</button>
        <button type="button" class="menu-item" (click)="emitAction('dual')">Páginas duplas</button>
        <button type="button" class="menu-item" (click)="emitAction('from-not-linked')">Puxar sem vínculo</button>
        <div class="border-t border-slate-800 my-1"></div>
        <button type="button" class="menu-item text-rose-300" (click)="emitNotLinkedAction()">
          Enviar para sem vínculo
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .menu-item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: #e2e8f0;
      cursor: pointer;
      background: transparent;
      border: none;
    }
    .menu-item:hover { background: #1e293b; }
  `]
})
export class PagesLinkRowComponent {
  @Input({ required: true }) page!: LinkedPage;
  @Input() dropHighlight = false;
  @Input() index = 0;

  @Output() dragPayload = new EventEmitter<{
    index: number;
    type: PageLinkSlot;
    page: LinkedPage;
  }>();
  @Output() dropPayload = new EventEmitter<{
    index: number;
    type: PageLinkSlot;
    page: LinkedPage;
  }>();
  @Output() menuAction = new EventEmitter<{ page: LinkedPage; action: PageSlotMenuAction }>();
  @Output() preview = new EventEmitter<{ url: string; label: string }>();
  @Output() imageMeasured = new EventEmitter<{
    page: LinkedPage;
    slot: 'manga' | 'left' | 'right';
    width: number;
    height: number;
  }>();

  readonly PAGE_EMPTY = PAGE_EMPTY;
  readonly slotLinked = PageLinkSlot.LINKED;
  readonly slotDual = PageLinkSlot.DUAL_PAGE;

  menuOpen = false;
  menuX = 0;
  menuY = 0;
  menuSide: 'left' | 'right' = 'left';

  get hasLeft(): boolean {
    return this.page.fileLinkLeftPage !== PAGE_EMPTY;
  }

  get hasRight(): boolean {
    return this.page.isDualImage && this.page.fileLinkRightPage !== PAGE_EMPTY;
  }

  onDragStart(ev: DragEvent, type: PageLinkSlot): void {
    if (!ev.dataTransfer) return;
    if (type === PageLinkSlot.LINKED && this.page.fileLinkLeftPage === PAGE_EMPTY) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData('application/x-page-link', JSON.stringify({
      index: this.index,
      type,
      kind: 'linked'
    }));
    ev.dataTransfer.effectAllowed = 'move';
    this.dragPayload.emit({ index: this.index, type, page: this.page });
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onDrop(ev: DragEvent, type: PageLinkSlot): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.dropPayload.emit({ index: this.index, type, page: this.page });
  }

  openMenu(ev: Event, side: 'left' | 'right'): void {
    ev.preventDefault();
    ev.stopPropagation();
    const e = ev as MouseEvent;
    this.menuSide = side;
    this.menuX = Math.min(e.clientX, window.innerWidth - 200);
    this.menuY = Math.min(e.clientY, window.innerHeight - 220);
    this.menuOpen = true;
  }

  emitAction(action: PageSlotMenuAction): void {
    this.menuOpen = false;
    this.menuAction.emit({ page: this.page, action });
  }

  emitNotLinkedAction(): void {
    this.emitAction(this.menuSide === 'right' ? 'to-not-linked-right' : 'to-not-linked-left');
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  onBackdropContext(ev: Event): void {
    ev.preventDefault();
    this.menuOpen = false;
  }

  onDualDragStart(ev: DragEvent): void {
    if (!this.hasRight) {
      ev.preventDefault();
      return;
    }
    this.onDragStart(ev, PageLinkSlot.DUAL_PAGE);
  }

  onDualContextMenu(ev: Event): void {
    if (!this.hasRight) {
      ev.preventDefault();
      return;
    }
    this.openMenu(ev, 'right');
  }

  onImgLoad(ev: Event, slot: 'manga' | 'left' | 'right'): void {
    const img = ev.target as HTMLImageElement;
    this.imageMeasured.emit({
      page: this.page,
      slot,
      width: img.naturalWidth,
      height: img.naturalHeight
    });
  }
}
