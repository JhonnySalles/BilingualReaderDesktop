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
import {
  TOUCH_DEMO_FADE_MS,
  TOUCH_DEMO_HOLD_MS,
  TouchZoneService
} from '../../core/services/touch-zone.service';

interface DemoCell {
  position: TouchPosition;
  action: TouchScreen;
  label: string;
  iconPaths: string[];
  hidden: boolean;
  isCorner: boolean;
  isCenter: boolean;
  cellClass: string;
}

@Component({
  selector: 'app-reader-touch-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible()) {
      <div
        #root
        class="absolute inset-0 z-[60] select-none transition-opacity"
        [style.transitionDuration.ms]="fadeMs"
        [class.opacity-0]="!opaque()"
        [class.opacity-100]="opaque()"
        [class.pointer-events-none]="!opaque()"
        (click)="dismiss.emit()">
        <div
          class="absolute inset-2 grid gap-2"
          [style.gridTemplateColumns]="gridColumns()"
          [style.gridTemplateRows]="gridRows()">
            @for (cell of cells(); track cell.position) {
            <div
              class="min-h-0 min-w-0 rounded-2xl border border-white/10 backdrop-blur-md flex items-center justify-center gap-2 px-3 overflow-hidden"
              [ngClass]="cell.cellClass"
              [class.invisible]="cell.hidden"
              [style.gridArea]="gridArea(cell.position)">
              @if (!cell.hidden) {
                <svg class="w-5 h-5 shrink-0 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  @for (d of cell.iconPaths; track d) {
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="d"/>
                  }
                </svg>
                <span class="text-sm font-semibold text-white/95 text-center leading-tight truncate">
                  {{ cell.label }}
                </span>
              }
            </div>
          }
        </div>
      </div>
    }
  `
})
export class ReaderTouchOverlayComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() open = false;
  @Input() type: ReaderTouchType = 'manga';
  @Input() autoDismiss = true;
  @Output() dismiss = new EventEmitter<void>();

  @ViewChild('root') rootRef?: ElementRef<HTMLElement>;

  private touch = inject(TouchZoneService);

  readonly fadeMs = TOUCH_DEMO_FADE_MS;
  visible = signal(false);
  opaque = signal(false);
  cells = signal<DemoCell[]>([]);
  gridColumns = signal('1fr 3fr 1fr');
  gridRows = signal('88px 1fr 88px');

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObs?: ResizeObserver;

  ngAfterViewInit(): void {
    this.observeSize();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['type']) {
      if (this.open) {
        this.show();
      } else {
        this.hideImmediate();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.resizeObs?.disconnect();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateGridMetrics();
  }

  private show(): void {
    this.clearTimers();
    this.buildCells();
    this.updateGridMetrics();
    this.visible.set(true);
    requestAnimationFrame(() => {
      this.opaque.set(true);
      this.observeSize();
    });

    if (this.autoDismiss) {
      this.holdTimer = setTimeout(() => {
        this.opaque.set(false);
        this.fadeTimer = setTimeout(() => {
          this.visible.set(false);
          this.dismiss.emit();
        }, TOUCH_DEMO_FADE_MS);
      }, TOUCH_DEMO_HOLD_MS);
    }
  }

  private hideImmediate(): void {
    this.clearTimers();
    this.opaque.set(false);
    this.visible.set(false);
  }

  private clearTimers(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private buildCells(): void {
    const map = this.touch.getMap(this.type);
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
      const isCenter = position === TouchPosition.CENTER;
      const action = isCenter
        ? TouchScreen.NOT_IMPLEMENTED
        : map[position as keyof TouchZoneMap];
      const meta = this.touch.getMeta(action);
      const isCorner =
        position === TouchPosition.CORNER_TOP_LEFT
        || position === TouchPosition.CORNER_TOP_RIGHT
        || position === TouchPosition.CORNER_BOTTOM_LEFT
        || position === TouchPosition.CORNER_BOTTOM_RIGHT;

      let hidden = false;
      if (isCorner) {
        hidden = this.touch.shouldHideCorner(
          map,
          position as TouchPosition.CORNER_TOP_LEFT
            | TouchPosition.CORNER_TOP_RIGHT
            | TouchPosition.CORNER_BOTTOM_LEFT
            | TouchPosition.CORNER_BOTTOM_RIGHT
        );
      }

      let cellClass = 'bg-slate-800/50';
      if (isCenter) cellClass = 'bg-slate-900/40 border-dashed';
      else if (isCorner) cellClass = 'bg-indigo-500/25';

      return {
        position,
        action,
        label: meta.label,
        iconPaths: meta.iconPaths,
        hidden,
        isCorner,
        isCenter,
        cellClass
      };
    }));
  }

  private observeSize(): void {
    const el = this.rootRef?.nativeElement?.parentElement;
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
    const parent = this.rootRef?.nativeElement?.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
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
