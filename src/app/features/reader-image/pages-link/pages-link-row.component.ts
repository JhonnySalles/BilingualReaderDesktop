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
      class="flex items-stretch gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg transition-all"
      [class.ring-2]="dropHighlight"
      [class.ring-indigo-500]="dropHighlight">
      
      <!-- Page Index -->
      <div class="flex flex-col items-center justify-center w-8 shrink-0">
        <span class="text-xs font-bold tabular-nums text-slate-400">{{ page.mangaPage + 1 }}</span>
      </div>

      <!-- Manga (anchor) -->
      <div class="relative flex-1 min-w-0 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 flex items-center justify-center group shadow-inner">
        @if (page.imageMangaPage) {
          <img
            [src]="page.imageMangaPage"
            alt="Manga"
            class="w-full h-56 sm:h-72 object-contain bg-black/30 pointer-events-auto"
            draggable="false"
            (load)="onImgLoad($event, 'manga')"
            (dblclick)="preview.emit({ url: page.imageMangaPage!, label: 'Mangá p.' + (page.mangaPage + 1) })" />
        } @else {
          <div class="h-56 sm:h-72 flex items-center justify-center text-xs text-slate-600">—</div>
        }
        @if (page.isMangaDualPage) {
          <span class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-slate-950 shadow">DUP</span>
        }
      </div>

      <!-- Arrow Indicator -->
      <div class="flex items-center text-slate-600 shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </div>

      <!-- Left linked slot -->
      <div
        class="relative flex-1 min-w-0 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-grab flex items-center justify-center group"
        [ngClass]="[
          dragOverLeft ? 'border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-400/50 scale-[1.01]' : '',
          !dragOverLeft && hasLeft ? 'border-slate-700/80 bg-slate-950' : '',
          !dragOverLeft && !hasLeft ? 'border-dashed border-slate-700 bg-slate-900/40 hover:border-slate-500' : ''
        ]"
        [attr.data-slot]="'LINKED'"
        (dragover)="onDragOverLeft($event)"
        (dragleave)="dragOverLeft = false"
        (drop)="onDropLeft($event)"
        draggable="true"
        (dragstart)="onDragStart($event, slotLinked)"
        (contextmenu)="openMenu($event, 'left')">
        @if (hasLeft) {
          <img
            [src]="page.imageLeftFileLinkPage || ''"
            alt="Vinculada"
            class="w-full h-56 sm:h-72 object-contain bg-black/30 pointer-events-none"
            draggable="false"
            (load)="onImgLoad($event, 'left')"
            (dblclick)="preview.emit({ url: page.imageLeftFileLinkPage!, label: 'Vinculada p.' + (page.fileLinkLeftPage + 1) })" />
          <span class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/75 text-slate-200 shadow">
            {{ page.fileLinkLeftPage + 1 }}
          </span>
          @if (page.isFileLeftDualPage) {
            <span class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500 text-white shadow">DUP</span>
          }
        } @else {
          <div class="h-56 sm:h-72 flex flex-col items-center justify-center gap-1 text-xs text-slate-500">
            <svg class="w-6 h-6 text-slate-600 mb-1 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Soltar página aqui</span>
          </div>
        }
        <button
          type="button"
          class="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-white hover:bg-black/80 cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
          title="Menu"
          (click)="openMenu($event, 'left')">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>

      <!-- Right / dual slot -->
      <div
        class="relative flex-1 min-w-0 rounded-xl overflow-hidden border-2 transition-all duration-200 flex items-center justify-center group"
        [ngClass]="[
          dragOverRight ? 'border-indigo-400 bg-indigo-950/40 ring-2 ring-indigo-400/50 scale-[1.01]' : '',
          !dragOverRight && hasRight ? 'border-slate-700/80 bg-slate-950 cursor-grab' : '',
          !dragOverRight && !hasRight ? 'border-dashed border-slate-700 bg-slate-900/40 hover:border-slate-500' : ''
        ]"
        [attr.data-slot]="'DUAL_PAGE'"
        (dragover)="onDragOverRight($event)"
        (dragleave)="dragOverRight = false"
        (drop)="onDropRight($event)"
        [attr.draggable]="hasRight ? 'true' : 'false'"
        (dragstart)="onDualDragStart($event)"
        (contextmenu)="onDualContextMenu($event)">
        @if (hasRight) {
          <img
            [src]="page.imageRightFileLinkPage"
            alt="Dual"
            class="w-full h-56 sm:h-72 object-contain bg-black/30 pointer-events-none"
            draggable="false"
            (load)="onImgLoad($event, 'right')"
            (dblclick)="preview.emit({ url: page.imageRightFileLinkPage!, label: 'Dual p.' + (page.fileLinkRightPage + 1) })" />
          <span class="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/75 text-slate-200 shadow">
            {{ page.fileLinkRightPage + 1 }}
          </span>
        } @else {
          <div class="h-56 sm:h-72 flex flex-col items-center justify-center gap-1 text-xs text-slate-500">
            <span class="text-2xl leading-none text-slate-600 font-light group-hover:text-slate-400 transition-colors">+</span>
            <span class="text-[11px] font-medium">Dual</span>
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

  dragOverLeft = false;
  dragOverRight = false;

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

  onDragOverLeft(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOverLeft = true;
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onDropLeft(ev: DragEvent): void {
    this.dragOverLeft = false;
    this.onDrop(ev, this.slotLinked);
  }

  onDragOverRight(ev: DragEvent): void {
    ev.preventDefault();
    this.dragOverRight = true;
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  }

  onDropRight(ev: DragEvent): void {
    this.dragOverRight = false;
    this.onDrop(ev, this.slotDual);
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

