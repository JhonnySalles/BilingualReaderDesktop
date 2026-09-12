import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmDialogService.activeDialog(); as dialog) {
      <div
        class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in select-none"
        (click)="confirmDialogService.handleCancel()">
        
        <div
          class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/60 overflow-hidden flex flex-col transform transition-all duration-200"
          (click)="$event.stopPropagation()">
          
          <!-- Header with Icon & Title -->
          <div class="px-5 pt-5 pb-4 flex items-start gap-3.5 border-b border-slate-800/80">
            <!-- Dynamic Icon Container -->
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              [ngClass]="{
                'bg-rose-500/10 border-rose-500/20 text-rose-400': dialog.icon === 'danger',
                'bg-amber-500/10 border-amber-500/20 text-amber-400': dialog.icon === 'warning',
                'bg-sky-500/10 border-sky-500/20 text-sky-400': dialog.icon === 'sync' || dialog.icon === 'info',
                'bg-indigo-500/10 border-indigo-500/20 text-indigo-400': dialog.icon === 'question' || !dialog.icon
              }">
              
              @if (dialog.icon === 'danger') {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              } @else if (dialog.icon === 'warning') {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              } @else if (dialog.icon === 'sync') {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              } @else if (dialog.icon === 'info') {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              } @else {
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            </div>

            <div class="flex-1 min-w-0 pt-0.5">
              <h3 class="text-sm font-bold text-slate-100 truncate">
                {{ dialog.title }}
              </h3>
              <p class="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line break-words">
                {{ dialog.message }}
              </p>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="px-5 py-3.5 bg-slate-950/40 flex items-center justify-end gap-2.5 border-t border-slate-800/60">
            <button
              type="button"
              (click)="confirmDialogService.handleCancel()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 transition-colors cursor-pointer">
              {{ dialog.cancelText }}
            </button>

            <button
              type="button"
              (click)="confirmDialogService.handleConfirm()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md"
              [ngClass]="{
                'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25': dialog.confirmVariant === 'danger',
                'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25': dialog.confirmVariant === 'warning' || dialog.confirmVariant === 'amber',
                'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25': dialog.confirmVariant === 'primary' || dialog.confirmVariant === 'indigo' || !dialog.confirmVariant
              }">
              {{ dialog.confirmText }}
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  readonly confirmDialogService = inject(ConfirmDialogService);

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.confirmDialogService.activeDialog()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.confirmDialogService.handleCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.confirmDialogService.handleConfirm();
    }
  }
}
