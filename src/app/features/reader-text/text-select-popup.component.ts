import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BookAnnotationColor,
  BOOK_ANNOTATION_COLOR_HEX
} from '../../core/models/entities/book.model';

@Component({
  selector: 'app-text-select-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        class="absolute z-[55] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl p-2
          pointer-events-auto select-none"
        [style.left.px]="left()"
        [style.top.px]="top()"
        role="toolbar"
        aria-label="Seleção de texto"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()">
        <div class="flex items-center justify-center gap-1">
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer
              flex items-center justify-center"
            title="Selecionar tudo"
            (click)="selectAll.emit()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h10M4 18h10"/>
            </svg>
          </button>
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer
              flex items-center justify-center"
            title="Copiar"
            (click)="copy.emit()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>
          <button
            type="button"
            disabled
            class="w-8 h-8 rounded-lg text-slate-600 cursor-not-allowed opacity-50 flex items-center justify-center"
            title="Buscar (em breve)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
            </svg>
          </button>
          <button
            type="button"
            disabled
            class="w-8 h-8 rounded-lg text-slate-600 cursor-not-allowed opacity-50 flex items-center justify-center"
            title="Traduzir (em breve)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
            </svg>
          </button>
          <button
            type="button"
            disabled
            class="w-8 h-8 rounded-lg text-slate-600 cursor-not-allowed opacity-50 flex items-center justify-center"
            title="TTS (em breve)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072M17.657 6.343a8 8 0 010 11.314M11 5l-5 4H3v6h3l5 4V5z"/>
            </svg>
          </button>
        </div>

        <div class="border-t border-slate-700 my-1.5"></div>

        <div class="flex items-center justify-center gap-1.5">
          @for (c of colors; track c) {
            <button
              type="button"
              class="w-8 h-8 rounded-full cursor-pointer border-2 border-transparent
                hover:ring-2 hover:ring-white/70 hover:ring-offset-1 hover:ring-offset-slate-900
                flex items-center justify-center"
              [style.backgroundColor]="hex(c)"
              [attr.title]="'Marcar ' + c"
              [attr.aria-label]="'Marcar ' + c"
              (click)="color.emit(c)">
            </button>
          }
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-slate-300 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer
              flex items-center justify-center"
            title="Apagar marcação"
            (click)="erase.emit()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    }
  `
})
export class TextSelectPopupComponent {
  visible = input(false);
  left = input(0);
  top = input(0);

  color = output<BookAnnotationColor>();
  erase = output<void>();
  copy = output<void>();
  selectAll = output<void>();
  dismiss = output<void>();

  readonly colors = [
    BookAnnotationColor.Yellow,
    BookAnnotationColor.Green,
    BookAnnotationColor.Blue,
    BookAnnotationColor.Red
  ];

  hex(color: BookAnnotationColor): string {
    return BOOK_ANNOTATION_COLOR_HEX[color] || BOOK_ANNOTATION_COLOR_HEX[BookAnnotationColor.Yellow];
  }
}
