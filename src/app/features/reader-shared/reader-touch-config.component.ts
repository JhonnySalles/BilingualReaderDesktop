import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  inject,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReaderTouchType,
  TouchPosition,
  TouchScreen,
  TouchZoneMap
} from '../../core/models';
import { TouchZoneService } from '../../core/services/touch-zone.service';
import { ReaderTouchActionPickerComponent } from './reader-touch-action-picker.component';

interface ConfigCell {
  position: Exclude<TouchPosition, TouchPosition.CENTER> | TouchPosition.CENTER;
  action: TouchScreen;
  label: string;
  iconPaths: string[];
  configurable: boolean;
  isCorner: boolean;
  cellClass: string;
}

@Component({
  selector: 'app-reader-touch-config',
  standalone: true,
  imports: [CommonModule, ReaderTouchActionPickerComponent],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-[70] flex flex-col bg-slate-950 select-none">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          @if (coverUrl) {
            <img [src]="coverUrl" alt="" class="absolute inset-0 w-full h-full object-cover scale-105" />
          } @else {
            <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950"></div>
          }
          <div class="absolute inset-0 bg-slate-950/55"></div>
        </div>

        <header class="relative z-10 shrink-0">
          <div class="h-14 px-4 sm:px-6 flex items-center gap-3 bg-slate-900/70 backdrop-blur-md border-b border-slate-800/50">
            <button type="button" (click)="close.emit()"
              class="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Voltar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <div class="min-w-0">
              <h2 class="text-sm font-bold text-slate-100 truncate">{{ title }}</h2>
              <p class="text-[10px] text-slate-400">Toque em uma zona para alterar a função</p>
            </div>
          </div>
        </header>

        <div #gridHost class="relative z-10 flex-1 min-h-0 p-3 sm:p-4">
          <div
            class="h-full w-full grid gap-2"
            [style.gridTemplateColumns]="gridColumns()"
            [style.gridTemplateRows]="gridRows()">
            @for (cell of cells(); track cell.position) {
              <button
                type="button"
                class="min-h-0 min-w-0 rounded-2xl border border-white/10 backdrop-blur-md flex items-center justify-center gap-2 px-3 overflow-hidden transition-colors"
                [ngClass]="cell.cellClass"
                [disabled]="!cell.configurable"
                [style.gridArea]="gridArea(cell.position)"
                (click)="onCellClick(cell)">
                <svg class="w-5 h-5 shrink-0 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  @for (d of cell.iconPaths; track d) {
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="d"/>
                  }
                </svg>
                <span class="text-sm font-semibold text-white/95 text-center leading-tight line-clamp-2">
                  {{ cell.label }}
                </span>
              </button>
            }
          </div>
        </div>

        <footer class="relative z-10 shrink-0 px-3 sm:px-4 pb-3 sm:pb-4">
          <div class="flex flex-col sm:flex-row gap-2">
            <button type="button" (click)="onSave()"
              class="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Salvar
            </button>
            <button type="button" (click)="onReset()"
              class="flex-1 h-12 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Restaurar padrão
            </button>
          </div>
        </footer>

        <app-reader-touch-action-picker
          [open]="pickerOpen()"
          [actions]="assignableActions"
          [selected]="editingAction()"
          (select)="onActionSelected($event)"
          (cancel)="closePicker()" />
      </div>
    }
  `
})
export class ReaderTouchConfigComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() open = false;
  @Input() type: ReaderTouchType = 'manga';
  @Input() coverUrl: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  @ViewChild('gridHost') gridHostRef?: ElementRef<HTMLElement>;

  private touch = inject(TouchZoneService);

  cells = signal<ConfigCell[]>([]);
  gridColumns = signal('1fr 3fr 1fr');
  gridRows = signal('88px 1fr 88px');
  pickerOpen = signal(false);
  editingAction = signal<TouchScreen | null>(null);
  editingPosition = signal<Exclude<TouchPosition, TouchPosition.CENTER> | null>(null);

  assignableActions = this.touch.getAssignableActions();

  private draft: TouchZoneMap = this.touch.getDefaults('manga');
  private resizeObs?: ResizeObserver;

  get title(): string {
    return this.type === 'manga'
      ? 'Funções de clique — Mangá'
      : 'Funções de clique — Livro';
  }

  ngAfterViewInit(): void {
    this.observeSize();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['type']) {
      if (this.open) {
        this.draft = this.touch.getMap(this.type);
        this.rebuildCells();
        this.updateGridMetrics();
        queueMicrotask(() => this.observeSize());
      } else {
        this.pickerOpen.set(false);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateGridMetrics();
  }

  onCellClick(cell: ConfigCell): void {
    if (!cell.configurable || cell.position === TouchPosition.CENTER) return;
    this.editingPosition.set(cell.position);
    this.editingAction.set(cell.action);
    this.pickerOpen.set(true);
  }

  onActionSelected(action: TouchScreen): void {
    const pos = this.editingPosition();
    if (!pos) return;
    this.draft = { ...this.draft, [pos]: action };
    this.rebuildCells();
    this.pickerOpen.set(false);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  onSave(): void {
    this.touch.saveMap(this.type, this.draft);
    this.saved.emit();
    this.close.emit();
  }

  onReset(): void {
    this.draft = this.touch.getDefaults(this.type);
    this.rebuildCells();
  }

  private rebuildCells(): void {
    const map = this.draft;
    const positions: TouchPosition[] = [
      TouchPosition.CORNER_TOP_LEFT,
      TouchPosition.TOP,
      TouchPosition.CORNER_TOP_RIGHT,
      TouchPosition.LEFT,
      TouchPosition.CENTER,
      TouchPosition.RIGHT,
      TouchPosition.CORNER_BOTTOM_LEFT,
      TouchPosition.BOTTOM,
      TouchPosition.CORNER_BOTTOM_RIGHT
    ];

    this.cells.set(positions.map(position => {
      const configurable = position !== TouchPosition.CENTER;
      const action = configurable
        ? map[position as keyof TouchZoneMap]
        : TouchScreen.NOT_IMPLEMENTED;
      const meta = this.touch.getMeta(action);
      const isCorner =
        position === TouchPosition.CORNER_TOP_LEFT
        || position === TouchPosition.CORNER_TOP_RIGHT
        || position === TouchPosition.CORNER_BOTTOM_LEFT
        || position === TouchPosition.CORNER_BOTTOM_RIGHT;

      let cellClass = 'cursor-default bg-slate-900/30 border-dashed';
      if (configurable && isCorner) {
        cellClass = 'cursor-pointer bg-indigo-500/30 hover:bg-indigo-500/45';
      } else if (configurable) {
        cellClass = 'cursor-pointer bg-slate-800/55 hover:bg-slate-700/60';
      }

      return {
        position,
        action,
        label: meta.label,
        iconPaths: meta.iconPaths,
        configurable,
        isCorner,
        cellClass
      };
    }));
  }

  private observeSize(): void {
    const el = this.gridHostRef?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      this.updateGridMetrics();
      return;
    }
    this.resizeObs?.disconnect();
    this.resizeObs = new ResizeObserver(() => this.updateGridMetrics());
    this.resizeObs.observe(el);
    this.updateGridMetrics();
  }

  private updateGridMetrics(): void {
    const el = this.gridHostRef?.nativeElement;
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    const style = this.touch.gridStyle(w, h);
    this.gridColumns.set(style.columns);
    this.gridRows.set(style.rows);
  }

  gridArea(position: TouchPosition): string {
    switch (position) {
      case TouchPosition.CORNER_TOP_LEFT: return '1 / 1';
      case TouchPosition.TOP: return '1 / 2';
      case TouchPosition.CORNER_TOP_RIGHT: return '1 / 3';
      case TouchPosition.LEFT: return '2 / 1';
      case TouchPosition.CENTER: return '2 / 2';
      case TouchPosition.RIGHT: return '2 / 3';
      case TouchPosition.CORNER_BOTTOM_LEFT: return '3 / 1';
      case TouchPosition.BOTTOM: return '3 / 2';
      case TouchPosition.CORNER_BOTTOM_RIGHT: return '3 / 3';
    }
  }
}
