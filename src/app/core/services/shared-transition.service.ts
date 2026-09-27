import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedTransitionService {
  /** The item currently selected/active for transition */
  private readonly activeItem = signal<{ type: 'manga' | 'book' | 'history'; id: string } | null>(null);

  setActiveItem(type: 'manga' | 'book' | 'history', id: number | string | undefined | null): void {
    if (id == null) {
      this.activeItem.set(null);
      return;
    }
    this.activeItem.set({ type, id: String(id) });
  }

  clearActiveItem(): void {
    this.activeItem.set(null);
  }

  isActive(id: number | string | undefined | null): boolean {
    if (id == null) return false;
    const current = this.activeItem();
    if (!current) return false;
    return String(current.id) === String(id);
  }

  getCoverName(id: number | string | undefined | null): string {
    return this.isActive(id) ? 'cover-active' : 'none';
  }

  getTitleName(id: number | string | undefined | null): string {
    return this.isActive(id) ? 'title-active' : 'none';
  }

  getProgressName(id: number | string | undefined | null): string {
    return this.isActive(id) ? 'progress-active' : 'none';
  }
}
