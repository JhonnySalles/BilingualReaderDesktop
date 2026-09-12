import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary' | 'indigo' | 'amber';
  icon?: 'danger' | 'warning' | 'info' | 'question' | 'sync';
}

export interface ActiveConfirmDialog extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  readonly activeDialog = signal<ActiveConfirmDialog | null>(null);

  confirm(options: ConfirmDialogOptions | string): Promise<boolean> {
    const opts: ConfirmDialogOptions =
      typeof options === 'string'
        ? { message: options }
        : options;

    return new Promise<boolean>((resolve) => {
      this.activeDialog.set({
        ...opts,
        title: opts.title || 'Confirmação',
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        confirmVariant: opts.confirmVariant || 'primary',
        icon: opts.icon || (opts.confirmVariant === 'danger' ? 'danger' : opts.confirmVariant === 'warning' || opts.confirmVariant === 'amber' ? 'warning' : 'question'),
        resolve
      });
    });
  }

  handleConfirm(): void {
    const current = this.activeDialog();
    if (current) {
      this.activeDialog.set(null);
      current.resolve(true);
    }
  }

  handleCancel(): void {
    const current = this.activeDialog();
    if (current) {
      this.activeDialog.set(null);
      current.resolve(false);
    }
  }
}
