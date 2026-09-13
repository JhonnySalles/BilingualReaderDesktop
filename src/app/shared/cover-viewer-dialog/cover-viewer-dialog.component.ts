import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookCover3dComponent } from '../book-cover-3d/book-cover-3d.component';

@Component({
  selector: 'app-cover-viewer-dialog',
  standalone: true,
  imports: [CommonModule, BookCover3dComponent],
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in select-none"
        (click)="onBackdropClick()">
        <div
          class="w-full max-w-5xl h-[85vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
          (click)="$event.stopPropagation()">
          
          <!-- Header -->
          <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
            <h2 class="text-base font-bold text-slate-100 flex items-center gap-2 truncate max-w-md">
              <span class="text-indigo-400">🖼️</span> {{ title || 'Visualizador de Capa' }}
            </h2>

            <div class="flex items-center gap-3">
              <!-- Zoom Controls (only shown for Image mode) -->
              @if (viewMode() === 'image') {
                <div class="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 text-xs font-medium text-slate-300">
                  <button
                    type="button"
                    (click)="zoomOut()"
                    [disabled]="zoom() <= minZoom"
                    title="Diminuir Zoom"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4"/>
                    </svg>
                  </button>

                  <button
                    type="button"
                    (click)="resetZoom()"
                    title="Redefinir Zoom"
                    class="px-2 h-7 flex items-center justify-center hover:bg-slate-800 rounded transition-colors text-[11px] font-semibold text-slate-300 min-w-[48px]">
                    {{ Math.round(zoom() * 100) }}%
                  </button>

                  <button
                    type="button"
                    (click)="zoomIn()"
                    [disabled]="zoom() >= maxZoom"
                    title="Aumentar Zoom"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                    </svg>
                  </button>
                </div>
              }

              <!-- Tabs -->
              <div class="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                <button 
                  type="button"
                  (click)="switchMode('image')"
                  [class.bg-indigo-600]="viewMode() === 'image'"
                  [class.text-white]="viewMode() === 'image'"
                  [class.text-slate-400]="viewMode() !== 'image'"
                  class="px-3 py-1 text-xs font-semibold rounded-md transition-colors hover:text-slate-200">
                  Imagem
                </button>
                <button 
                  type="button"
                  (click)="switchMode('3d')"
                  [class.bg-indigo-600]="viewMode() === '3d'"
                  [class.text-white]="viewMode() === '3d'"
                  [class.text-slate-400]="viewMode() !== '3d'"
                  class="px-3 py-1 text-xs font-semibold rounded-md transition-colors hover:text-slate-200">
                  3D
                </button>
              </div>

              <button
                type="button"
                (click)="cancel.emit()"
                class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div 
            class="flex-1 overflow-hidden relative bg-black/40 flex items-center justify-center"
            (wheel)="onWheel($event)"
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp()"
            (mouseleave)="onMouseUp()">
            @if (viewMode() === 'image') {
              <div 
                class="w-full h-full flex items-center justify-center p-6 transition-transform"
                [style.cursor]="isDragging() ? 'grabbing' : (zoom() > 1 ? 'grab' : 'default')"
                [style.transform]="'translate(' + panX() + 'px, ' + panY() + 'px) scale(' + zoom() + ')'"
                [style.transformOrigin]="'center center'">
                <img 
                  [src]="safeCoverUrl" 
                  alt="Capa Completa" 
                  draggable="false"
                  class="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm pointer-events-none select-none"
                />
              </div>
            } @else {
              <div class="absolute inset-0">
                <app-book-cover-3d
                  [coverUrl]="safeCoverUrl"
                  [backCoverUrl]="safeBackCoverUrl"
                  [isPopup]="true"
                  [isFullCover]="isFullCover">
                </app-book-cover-3d>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class CoverViewerDialogComponent {
  @Input() open = false;
  @Input() coverUrl: string | null = null;
  @Input() backCoverUrl: string | null = null;
  @Input() title: string | null = null;
  @Input() isFullCover = false;

  @Output() cancel = new EventEmitter<void>();

  viewMode = signal<'image' | '3d'>('3d');

  // Zoom & Pan states
  readonly minZoom = 0.5;
  readonly maxZoom = 5.0;
  readonly zoomStep = 0.25;
  readonly Math = Math;

  zoom = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);
  isDragging = signal<boolean>(false);

  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;

  get safeCoverUrl(): string | null {
    if (!this.coverUrl) return null;
    return this.coverUrl.replace(/\\/g, '/');
  }

  get safeBackCoverUrl(): string | null {
    if (!this.backCoverUrl) return null;
    return this.backCoverUrl.replace(/\\/g, '/');
  }

  switchMode(mode: 'image' | '3d') {
    this.viewMode.set(mode);
    this.resetZoom();
  }

  onBackdropClick(): void {
    this.resetZoom();
    this.cancel.emit();
  }

  zoomIn(): void {
    this.zoom.update(z => Math.min(this.maxZoom, Math.round((z + this.zoomStep) * 100) / 100));
  }

  zoomOut(): void {
    this.zoom.update(z => {
      const next = Math.max(this.minZoom, Math.round((z - this.zoomStep) * 100) / 100);
      if (next <= 1) {
        this.panX.set(0);
        this.panY.set(0);
      }
      return next;
    });
  }

  resetZoom(): void {
    this.zoom.set(1);
    this.panX.set(0);
    this.panY.set(0);
    this.isDragging.set(false);
  }

  onWheel(event: WheelEvent): void {
    if (this.viewMode() !== 'image') return;
    event.preventDefault();

    const delta = event.deltaY < 0 ? this.zoomStep : -this.zoomStep;
    this.zoom.update(z => {
      const next = Math.min(this.maxZoom, Math.max(this.minZoom, Math.round((z + delta) * 100) / 100));
      if (next <= 1) {
        this.panX.set(0);
        this.panY.set(0);
      }
      return next;
    });
  }

  onMouseDown(event: MouseEvent): void {
    if (this.viewMode() !== 'image' || event.button !== 0) return;
    this.isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging() || this.viewMode() !== 'image') return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.panX.set(this.initialPanX + dx);
    this.panY.set(this.initialPanY + dy);
  }

  onMouseUp(): void {
    this.isDragging.set(false);
  }
}
