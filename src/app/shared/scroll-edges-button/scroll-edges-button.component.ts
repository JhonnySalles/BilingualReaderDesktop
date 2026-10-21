import {
  Component,
  Input,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  computeScrollEdgesVisibility,
  isBigScroll,
  smoothScrollTo
} from './scroll-edges.util';

@Component({
  selector: 'app-scroll-edges-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Botão Ir para o Início (Topo) - Centralizado abaixo da barra de sincronização -->
    <div
      class="absolute z-40 transition-all duration-300 pointer-events-none"
      [ngClass]="[
        topPositionClass,
        (canScrollUp() && isVisible())
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-3'
      ]">
      <button
        type="button"
        (click)="scrollToTop()"
        (mouseenter)="onHoverTop(true)"
        (mouseleave)="onHoverTop(false)"
        [attr.tabindex]="(canScrollUp() && isVisible()) ? 0 : -1"
        class="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-2xl backdrop-blur-xl border cursor-pointer focus:outline-none group"
        [class.pointer-events-auto]="canScrollUp() && isVisible()"
        [ngClass]="accent === 'amber'
          ? 'bg-slate-900/90 text-amber-300 border-slate-700/70 hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-200 hover:shadow-amber-500/25 active:bg-amber-950/40'
          : (accent === 'primary'
              ? 'bg-slate-900/90 border-slate-700/70 hover:bg-slate-800 scroll-edge-primary'
              : 'bg-slate-900/90 text-indigo-300 border-slate-700/70 hover:border-indigo-500/70 hover:bg-slate-800 hover:text-indigo-200 hover:shadow-indigo-500/25 active:bg-indigo-950/40')"
        title="Ir para o início (topo)">
        <svg xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5 transition-transform duration-200"
          [class.animate-arrow-up]="isAnimatingUp()"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
        </svg>
      </button>
    </div>

    <!-- Botão Ir para o Fim (Rodapé) - Centralizado no rodapé da página -->
    <div
      class="absolute z-40 transition-all duration-300 pointer-events-none"
      [ngClass]="[
        bottomPositionClass,
        (canScrollDown() && isVisible())
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-3'
      ]">
      <button
        type="button"
        (click)="scrollToBottom()"
        (mouseenter)="onHoverBottom(true)"
        (mouseleave)="onHoverBottom(false)"
        [attr.tabindex]="(canScrollDown() && isVisible()) ? 0 : -1"
        class="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-2xl backdrop-blur-xl border cursor-pointer focus:outline-none group"
        [class.pointer-events-auto]="canScrollDown() && isVisible()"
        [ngClass]="accent === 'amber'
          ? 'bg-slate-900/90 text-amber-300 border-slate-700/70 hover:border-amber-500/70 hover:bg-slate-800 hover:text-amber-200 hover:shadow-amber-500/25 active:bg-amber-950/40'
          : (accent === 'primary'
              ? 'bg-slate-900/90 border-slate-700/70 hover:bg-slate-800 scroll-edge-primary'
              : 'bg-slate-900/90 text-indigo-300 border-slate-700/70 hover:border-indigo-500/70 hover:bg-slate-800 hover:text-indigo-200 hover:shadow-indigo-500/25 active:bg-indigo-950/40')"
        title="Ir para o final (fim)">
        <svg xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5 transition-transform duration-200"
          [class.animate-arrow-down]="isAnimatingDown()"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 13l-7 7-7-7M19 5l-7 7-7-7" />
        </svg>
      </button>
    </div>
  `
})
export class ScrollEdgesButtonComponent implements AfterViewInit, OnDestroy, OnChanges {
  private elRef = inject(ElementRef);

  @Input() target?: HTMLElement | null;
  @Input() accent: 'indigo' | 'amber' | 'primary' = 'indigo';
  @Input() threshold: number = 200;
  @Input() minScrollDistance: number = 160;
  @Input() topPositionClass: string = 'top-36 left-1/2 -translate-x-1/2';
  @Input() bottomPositionClass: string = 'bottom-6 left-1/2 -translate-x-1/2';

  canScrollUp = signal<boolean>(false);
  canScrollDown = signal<boolean>(false);
  isVisible = signal<boolean>(false);

  isAnimatingUp = signal<boolean>(false);
  isAnimatingDown = signal<boolean>(false);

  private resolvedScrollEl: HTMLElement | null = null;
  private scrollRafId: number | null = null;
  private resizeObserver?: ResizeObserver;

  private lastRestScrollTop: number = 0;
  private hideTimer: any = null;
  private isHoveredTop: boolean = false;
  private isHoveredBottom: boolean = false;

  ngAfterViewInit(): void {
    this.bindTarget();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['target'] && !changes['target'].firstChange) {
      this.bindTarget();
    }
  }

  ngOnDestroy(): void {
    this.unbindTarget();
  }

  private bindTarget(): void {
    this.unbindTarget();

    const host = this.elRef.nativeElement as HTMLElement;
    this.resolvedScrollEl = this.target || host.closest('.overflow-y-auto') || host.parentElement;

    if (this.resolvedScrollEl) {
      this.lastRestScrollTop = this.resolvedScrollEl.scrollTop;
      this.resolvedScrollEl.addEventListener('scroll', this.onScroll, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.checkScroll(false);
        });
        this.resizeObserver.observe(this.resolvedScrollEl);
        if (this.resolvedScrollEl.firstElementChild) {
          this.resizeObserver.observe(this.resolvedScrollEl.firstElementChild);
        }
      }

      // Initial check (sem ativar visibilidade inicial)
      setTimeout(() => this.checkScroll(false), 50);
    }
  }

  private unbindTarget(): void {
    if (this.resolvedScrollEl) {
      this.resolvedScrollEl.removeEventListener('scroll', this.onScroll);
      this.resolvedScrollEl = null;
    }
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private onScroll = (): void => {
    if (this.scrollRafId !== null) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = null;
      this.checkScroll(true);
    });
  };

  checkScroll(fromUserScroll: boolean = false): void {
    const el = this.resolvedScrollEl;
    if (!el) {
      this.canScrollUp.set(false);
      this.canScrollDown.set(false);
      this.isVisible.set(false);
      return;
    }

    const currentScroll = el.scrollTop;
    const visibility = computeScrollEdgesVisibility(
      currentScroll,
      el.scrollHeight,
      el.clientHeight,
      this.threshold
    );

    this.canScrollUp.set(visibility.canScrollUp);
    this.canScrollDown.set(visibility.canScrollDown);

    if (fromUserScroll) {
      // Verifica se houve uma rolagem grande
      const big = isBigScroll(currentScroll, this.lastRestScrollTop, this.minScrollDistance);
      if (big && (visibility.canScrollUp || visibility.canScrollDown)) {
        this.isVisible.set(true);
      }

      // Enquanto estiver realizando scroll e o botão estiver visível, mantém o botão e posterga o timer de 3 segundos
      if (this.isVisible()) {
        this.restartHideTimer();
      }
    } else {
      // Se a lista mudou de tamanho e não é mais rolável, esconde
      if (!visibility.canScrollUp && !visibility.canScrollDown) {
        this.isVisible.set(false);
      }
    }
  }

  private restartHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }
    this.hideTimer = setTimeout(() => {
      if (!this.isHoveredTop && !this.isHoveredBottom) {
        this.isVisible.set(false);
        if (this.resolvedScrollEl) {
          this.lastRestScrollTop = this.resolvedScrollEl.scrollTop;
        }
      }
    }, 3000);
  }

  onHoverTop(hovered: boolean): void {
    this.isHoveredTop = hovered;
    this.handleHoverChange();
  }

  onHoverBottom(hovered: boolean): void {
    this.isHoveredBottom = hovered;
    this.handleHoverChange();
  }

  private handleHoverChange(): void {
    if (this.isHoveredTop || this.isHoveredBottom) {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    } else {
      if (this.isVisible()) {
        this.restartHideTimer();
      }
    }
  }

  scrollToTop(): void {
    this.isAnimatingUp.set(true);
    setTimeout(() => this.isAnimatingUp.set(false), 550);
    this.isVisible.set(true);
    this.restartHideTimer();
    smoothScrollTo(this.resolvedScrollEl, 0);
  }

  scrollToBottom(): void {
    const el = this.resolvedScrollEl;
    if (!el) return;
    this.isAnimatingDown.set(true);
    setTimeout(() => this.isAnimatingDown.set(false), 550);
    this.isVisible.set(true);
    this.restartHideTimer();
    smoothScrollTo(el, el.scrollHeight);
  }
}
