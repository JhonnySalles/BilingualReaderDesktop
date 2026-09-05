import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LibraryStateService } from '../../../../../core/services/library-state.service';
import { OrderType, LibraryViewType } from '../../../../../core/models';

@Component({
  selector: 'app-manga-filter-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in" (click)="close.emit()">
      
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-indigo-950/20 text-slate-200" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex justify-between items-center pb-4 border-b border-slate-800 mb-5">
          <h3 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Opções da Biblioteca
          </h3>
          <button (click)="close.emit()" class="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors">
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
                (click)="libraryStateService.setCurrentView(viewOpt.value)"
                [class.bg-indigo-600]="libraryStateService.currentView() === viewOpt.value"
                [class.text-white]="libraryStateService.currentView() === viewOpt.value"
                [class.bg-slate-800]="libraryStateService.currentView() !== viewOpt.value"
                [class.text-slate-300]="libraryStateService.currentView() !== viewOpt.value"
                class="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-700/60 text-xs font-medium transition-all text-center">
                {{ viewOpt.label }}
              </button>
            }
          </div>
        </div>

        <!-- Order Options -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Ordenar Por</label>
            <button (click)="libraryStateService.toggleSortDirection()" class="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium">
              {{ libraryStateService.isAscending() ? 'Crescente ↑' : 'Decrescente ↓' }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            @for (order of orderOptions; track order.value) {
              <button 
                (click)="libraryStateService.setCurrentOrder(order.value)"
                [class.border-indigo-500]="libraryStateService.currentOrder() === order.value"
                [class.bg-indigo-950]="libraryStateService.currentOrder() === order.value"
                [class.text-indigo-300]="libraryStateService.currentOrder() === order.value"
                class="p-2.5 rounded-xl border border-slate-800 bg-slate-800/50 text-left text-sm font-medium hover:border-slate-700 transition-all">
                {{ order.label }}
              </button>
            }
          </div>
        </div>

        <!-- Footer -->
        <button (click)="close.emit()" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/20">
          Concluído
        </button>

      </div>
    </div>
  `
})
export class MangaFilterModalComponent {
  @Output() close = new EventEmitter<void>();

  public libraryStateService = inject(LibraryStateService);

  orderOptions = [
    { label: 'Nome', value: OrderType.Name },
    { label: 'Data de Adição', value: OrderType.Date },
    { label: 'Último Acesso', value: OrderType.LastAccess },
    { label: 'Favorito', value: OrderType.Favorite },
    { label: 'Autor', value: OrderType.Author }
  ];

  viewOptions = [
    { label: 'Grid Grande', value: LibraryViewType.GRID_BIG },
    { label: 'Grid Médio', value: LibraryViewType.GRID_MEDIUM },
    { label: 'Grid Blur (Overlay)', value: LibraryViewType.GRID_OVERLAY },
    { label: 'Grande c/ Separador', value: LibraryViewType.SEPARATOR_BIG },
    { label: 'Médio c/ Separador', value: LibraryViewType.SEPARATOR_MEDIUM },
    { label: 'Grid Blur c/ Sep.', value: LibraryViewType.SEPARATOR_OVERLAY },
    { label: 'Linha c/ Separador', value: LibraryViewType.SEPARATOR_LINE },
    { label: 'Linha Detalhada', value: LibraryViewType.LINE }
  ];

  OrderType = OrderType;
  LibraryViewType = LibraryViewType;
}
