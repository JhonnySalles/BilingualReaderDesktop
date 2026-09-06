import { Component, HostListener, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnnotationItem,
  BOOK_ANNOTATION_COLOR_HEX,
  BookAnnotationColor
} from '../../../core/models';
import { markTypeLabel } from '../annotation-group.util';

@Component({
  selector: 'app-annotation-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group relative w-full text-left rounded-xl border border-slate-800/80 bg-slate-900/60
        hover:border-indigo-500/40 hover:bg-slate-900 transition-all px-3 py-3 cursor-pointer"
      (click)="open.emit(item)">
      <div class="flex items-center gap-2 mb-2">
        <button
          type="button"
          class="p-1 rounded-lg shrink-0 cursor-pointer transition-colors"
          [class.text-amber-400]="item.favorite"
          [class.text-slate-500]="!item.favorite"
          [class.hover:text-amber-300]="!item.favorite"
          title="Favorito"
          (click)="onFavorite($event)">
          @if (item.favorite) {
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          } @else {
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          }
        </button>

        <p class="flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wider text-slate-300 truncate">
          Página {{ item.page + 1 }} de {{ item.pages || '?' }} · {{ typeLabel() }}
        </p>

        <div class="relative shrink-0">
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
            title="Opções"
            (click)="toggleMenu($event)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
            </svg>
          </button>

          @if (menuOpen()) {
            <div
              class="absolute right-0 top-full mt-1 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-30"
              (click)="$event.stopPropagation()">
              <button type="button" class="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
                (click)="onFavoriteMenu()">
                {{ item.favorite ? 'Remover favorito' : 'Favoritar' }}
              </button>
              @if (isDetach()) {
                <button type="button" class="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
                  (click)="colorPickerOpen.set(true); menuOpen.set(false)">
                  Mudar cor
                </button>
              }
              <button type="button" class="w-full text-left px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                (click)="onRemove()">
                Excluir
              </button>
            </div>
          }
        </div>
      </div>

      @if (isDetach()) {
        <div class="flex gap-2.5">
          <div
            class="w-0.5 shrink-0 rounded-full self-stretch min-h-[1.5rem]"
            [style.backgroundColor]="colorHex()"></div>
          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-sm text-slate-200 leading-snug whitespace-pre-wrap break-words">{{ item.text }}</p>

            @if (item.note) {
              <button
                type="button"
                class="flex items-start gap-1.5 text-left w-full cursor-pointer group/note"
                (click)="onEditNote($event)">
                <svg class="w-3.5 h-3.5 mt-0.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                <span class="text-xs text-indigo-300/90 group-hover/note:text-indigo-200 whitespace-pre-wrap break-words">
                  {{ item.note }}
                </span>
              </button>
            } @else {
              <button
                type="button"
                class="text-[11px] font-semibold text-slate-400 hover:text-indigo-300 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800"
                (click)="onEditNote($event)">
                Adicionar nota
              </button>
            }
          </div>
        </div>
      } @else {
        <p class="text-sm text-slate-300 leading-snug">{{ item.text || 'Marca de página' }}</p>
      }

      @if (colorPickerOpen()) {
        <div
          class="mt-3 flex items-center justify-center gap-3 pt-2 border-t border-slate-800"
          (click)="$event.stopPropagation()">
          @for (c of colors; track c) {
            <button
              type="button"
              class="w-7 h-7 rounded-full cursor-pointer border-2 border-transparent flex items-center justify-center"
              [class.ring-2]="item.color === c"
              [class.ring-white]="item.color === c"
              [style.backgroundColor]="hex(c)"
              [attr.title]="c"
              (click)="onChangeColor(c, $event)">
            </button>
          }
          <button type="button" class="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer ml-1"
            (click)="colorPickerOpen.set(false)">
            Fechar
          </button>
        </div>
      }
    </div>
  `
})
export class AnnotationCardComponent {
  @Input({ required: true }) item!: AnnotationItem;
  @Output() open = new EventEmitter<AnnotationItem>();
  @Output() toggleFavorite = new EventEmitter<AnnotationItem>();
  @Output() editNote = new EventEmitter<AnnotationItem>();
  @Output() changeColor = new EventEmitter<{ item: AnnotationItem; color: string }>();
  @Output() remove = new EventEmitter<AnnotationItem>();

  readonly colors = [
    BookAnnotationColor.Yellow,
    BookAnnotationColor.Green,
    BookAnnotationColor.Blue,
    BookAnnotationColor.Red
  ];

  menuOpen = signal(false);
  colorPickerOpen = signal(false);

  typeLabel(): string {
    return markTypeLabel(this.item.markType);
  }

  isDetach(): boolean {
    return (this.item.markType || 'Annotation') === 'Annotation';
  }

  colorHex(): string {
    return this.hex((this.item.color as BookAnnotationColor) || BookAnnotationColor.Yellow);
  }

  hex(color: BookAnnotationColor): string {
    return BOOK_ANNOTATION_COLOR_HEX[color] || BOOK_ANNOTATION_COLOR_HEX[BookAnnotationColor.Yellow];
  }

  toggleMenu(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuOpen.update(v => !v);
    this.colorPickerOpen.set(false);
  }

  onFavorite(ev: MouseEvent): void {
    ev.stopPropagation();
    this.toggleFavorite.emit(this.item);
  }

  onFavoriteMenu(): void {
    this.menuOpen.set(false);
    this.toggleFavorite.emit(this.item);
  }

  onEditNote(ev: MouseEvent): void {
    ev.stopPropagation();
    this.menuOpen.set(false);
    this.editNote.emit(this.item);
  }

  onChangeColor(color: BookAnnotationColor, ev: MouseEvent): void {
    ev.stopPropagation();
    this.colorPickerOpen.set(false);
    this.changeColor.emit({ item: this.item, color });
  }

  onRemove(): void {
    this.menuOpen.set(false);
    this.remove.emit(this.item);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.menuOpen.set(false);
  }
}
