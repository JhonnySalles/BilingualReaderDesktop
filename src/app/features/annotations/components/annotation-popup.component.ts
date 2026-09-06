import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  input,
  output,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BookAnnotation,
  BookAnnotationColor,
  BOOK_ANNOTATION_COLOR_HEX
} from '../../../core/models/entities/book.model';

@Component({
  selector: 'app-annotation-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      (click)="onBackdrop($event)">
      <div
        class="w-[min(92vw,24rem)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annotation-popup-title">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="min-w-0">
            <p id="annotation-popup-title" class="text-sm font-bold text-slate-100">
              Anotação — Página {{ annotation().page + 1 }}
            </p>
            @if (annotation().chapter) {
              <p class="text-[10px] text-slate-400 truncate mt-0.5">{{ annotation().chapter }}</p>
            }
          </div>
          <button
            type="button"
            (click)="cancel.emit()"
            class="p-1 text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg shrink-0"
            title="Fechar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        @if (annotation().text) {
          <p class="text-xs text-slate-400 italic line-clamp-3 mb-3 border-l-2 border-slate-600 pl-2">
            “{{ annotation().text }}”
          </p>
        }

        <label class="block text-[11px] text-slate-400 mb-1">Nota</label>
        <textarea
          #noteInput
          rows="4"
          class="w-full mb-4 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200
            placeholder:text-slate-500 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Escreva uma anotação (opcional)…"
          [(ngModel)]="note"
          (keydown)="onTextareaKeydown($event)"></textarea>

        <p class="text-[11px] text-slate-400 mb-2">Cor da marcação</p>
        <div class="flex items-center justify-center gap-3 mb-5">
          @for (c of colors; track c) {
            <button
              type="button"
              class="w-9 h-9 rounded-full cursor-pointer transition-all border-2 border-transparent
                flex items-center justify-center"
              [class.ring-2]="selectedColor() === c"
              [class.ring-white]="selectedColor() === c"
              [class.ring-offset-2]="selectedColor() === c"
              [class.ring-offset-slate-900]="selectedColor() === c"
              [style.backgroundColor]="hex(c)"
              [attr.title]="c"
              [attr.aria-label]="'Cor ' + c"
              [attr.aria-pressed]="selectedColor() === c"
              (click)="selectedColor.set(c)">
              @if (selectedColor() === c) {
                <svg class="w-4 h-4 text-slate-950 drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                </svg>
              }
            </button>
          }
        </div>

        <div class="flex items-center justify-between gap-2">
          <div>
            @if (annotation().id) {
              <button
                type="button"
                (click)="delete.emit()"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 cursor-pointer">
                Excluir
              </button>
            }
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="cancel.emit()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirm()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AnnotationPopupComponent {
  @ViewChild('noteInput') noteInputRef?: ElementRef<HTMLTextAreaElement>;

  annotation = input.required<BookAnnotation>();
  save = output<BookAnnotation>();
  delete = output<void>();
  cancel = output<void>();

  readonly colors = [
    BookAnnotationColor.Yellow,
    BookAnnotationColor.Green,
    BookAnnotationColor.Blue,
    BookAnnotationColor.Red
  ];

  note = '';
  selectedColor = signal<BookAnnotationColor>(BookAnnotationColor.Yellow);

  constructor() {
    effect(() => {
      const a = this.annotation();
      this.note = a.note || '';
      const color = (a.color as BookAnnotationColor) || BookAnnotationColor.Yellow;
      this.selectedColor.set(
        this.colors.includes(color) ? color : BookAnnotationColor.Yellow
      );
      queueMicrotask(() => this.noteInputRef?.nativeElement?.focus());
    });
  }

  hex(color: BookAnnotationColor): string {
    return BOOK_ANNOTATION_COLOR_HEX[color] || BOOK_ANNOTATION_COLOR_HEX[BookAnnotationColor.Yellow];
  }

  confirm(): void {
    this.save.emit({
      ...this.annotation(),
      note: this.note,
      color: this.selectedColor()
    });
  }

  onBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) {
      this.cancel.emit();
    }
  }

  onTextareaKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      this.confirm();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(ev: Event): void {
    ev.preventDefault();
    this.cancel.emit();
  }
}
