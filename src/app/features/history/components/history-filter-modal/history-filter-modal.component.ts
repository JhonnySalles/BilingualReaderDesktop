import { Component, EventEmitter, Output, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryStateService } from '../../../../core/services/library-state.service';
import { HistoryUiStateService } from '../../../../core/services/history-ui-state.service';
import { OrderType, LibraryViewType } from '../../../../core/models';

@Component({
  selector: 'app-history-filter-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">

      <div
        class="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl text-slate-200"
        [ngClass]="isBook() ? 'shadow-amber-950/30' : 'shadow-indigo-950/30'"
        (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex justify-between items-center pb-4 border-b border-slate-800 mb-5">
          <h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 transition-colors"
              [class.text-indigo-400]="!isBook()"
              [class.text-amber-400]="isBook()"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Opções do Histórico</span>
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium border"
              [ngClass]="isBook() ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'">
              {{ isBook() ? 'Livros' : 'Mangás' }}
            </span>
          </h3>
          <button
            type="button"
            (click)="close.emit()"
            class="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- View Mode -->
        <div class="mb-6">
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Modo de Exibição</label>
          <div class="grid grid-cols-2 gap-2">
            @for (viewOpt of viewOptions; track viewOpt.value) {
              <button
                type="button"
                (click)="libraryStateService.setCurrentView(viewOpt.value)"
                [ngClass]="libraryStateService.currentView() === viewOpt.value 
                  ? (isBook() ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white')
                  : 'bg-slate-800 text-slate-300'"
                class="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-700/60 text-xs font-medium transition-all text-center cursor-pointer hover:border-slate-600">
                {{ viewOpt.label }}
              </button>
            }
          </div>
        </div>

        <!-- Order Options -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Ordenar Por</label>
            <button
              type="button"
              (click)="libraryStateService.toggleSortDirection()"
              class="text-xs flex items-center gap-1 font-medium hover:underline cursor-pointer transition-colors"
              [class.text-indigo-400]="!isBook()"
              [class.text-amber-400]="isBook()">
              {{ libraryStateService.isAscending() ? 'Crescente ↑' : 'Decrescente ↓' }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            @for (order of orderOptions; track order.value) {
              <button
                type="button"
                (click)="libraryStateService.setCurrentOrder(order.value)"
                [ngClass]="libraryStateService.currentOrder() === order.value
                  ? (isBook() ? 'border-amber-500 bg-amber-950/70 text-amber-300' : 'border-indigo-500 bg-indigo-950/70 text-indigo-300')
                  : 'border-slate-800 bg-slate-800/50 text-slate-300'"
                class="p-2.5 rounded-xl border text-left text-sm font-medium hover:border-slate-700 transition-all cursor-pointer">
                {{ order.label }}
              </button>
            }
          </div>
        </div>

        <!-- Footer -->
        <button
          type="button"
          (click)="close.emit()"
          [ngClass]="isBook()
            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'"
          class="w-full py-2.5 rounded-xl text-white font-medium text-sm transition-all cursor-pointer shadow-lg">
          Concluído
        </button>

      </div>
    </div>
  `
})
export class HistoryFilterModalComponent {
  @Output() close = new EventEmitter<void>();

  public libraryStateService = inject(LibraryStateService);
  public historyUi = inject(HistoryUiStateService);

  readonly isBook = computed(() => this.historyUi.activeType() === 'BOOK');

  orderOptions = [
    { label: 'Último Acesso / Data', value: OrderType.LastAccess },
    { label: 'Nome', value: OrderType.Name },
    { label: 'Autor', value: OrderType.Author },
    { label: 'Favorito', value: OrderType.Favorite }
  ];

  viewOptions = [
    { label: 'Grid Grande', value: LibraryViewType.GRID_BIG },
    { label: 'Grande c/ Separador', value: LibraryViewType.SEPARATOR_BIG },
    { label: 'Grid Médio', value: LibraryViewType.GRID_MEDIUM },
    { label: 'Médio c/ Separador', value: LibraryViewType.SEPARATOR_MEDIUM },
    { label: 'Grid Blur', value: LibraryViewType.GRID_OVERLAY },
    { label: 'Grid Blur c/ Sep.', value: LibraryViewType.SEPARATOR_OVERLAY },
    { label: 'Linha Detalhada', value: LibraryViewType.LINE },
    { label: 'Linha c/ Separador', value: LibraryViewType.SEPARATOR_LINE }
  ];

  OrderType = OrderType;
  LibraryViewType = LibraryViewType;

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
