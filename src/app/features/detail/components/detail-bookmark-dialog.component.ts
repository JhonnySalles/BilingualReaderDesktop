import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-detail-bookmark-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 bg-opacity-70 p-4" (click)="cancel.emit()">
        <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl" (click)="$event.stopPropagation()">
          <h3 class="text-sm font-bold text-slate-100">Definir bookmark</h3>
          <p class="text-xs text-slate-400">Informe a página (0 a {{ maxPages }}).</p>
          <input
            type="number"
            min="0"
            [max]="maxPages"
            class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            [(ngModel)]="localPage" />
          <div class="flex justify-end gap-2">
            <button type="button" (click)="cancel.emit()"
              class="px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
            <button type="button" (click)="confirm.emit(localPage)"
              class="px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
              [ngClass]="accent === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-600 hover:bg-amber-500'">
              Salvar
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class DetailBookmarkDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() maxPages = 1;
  @Input() pageValue = 0;
  @Input() accent: 'indigo' | 'amber' = 'indigo';
  @Output() confirm = new EventEmitter<number>();
  @Output() cancel = new EventEmitter<void>();

  localPage = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageValue'] || changes['open']) {
      this.localPage = this.pageValue;
    }
  }
}
