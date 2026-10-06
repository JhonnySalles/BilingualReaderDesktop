import { Injectable, signal } from '@angular/core';

export type TransitionItemType = 'manga' | 'book' | 'history';

@Injectable({
  providedIn: 'root'
})
export class SharedTransitionService {
  /** The item currently selected/active for transition */
  private readonly activeItem = signal<{ type: TransitionItemType; id: string; instanceId?: string } | null>(null);

  setActiveItem(type: TransitionItemType, id: number | string | undefined | null, instanceId?: string): void {
    if (id == null) {
      this.activeItem.set(null);
      return;
    }
    this.activeItem.set({ type, id: String(id), instanceId });
  }

  clearActiveItem(): void {
    this.activeItem.set(null);
  }

  isActive(id?: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): boolean {
    if (id == null) return false;
    const current = this.activeItem();
    if (!current) return false;

    if (type && current.type !== type) return false;
    if (String(current.id) !== String(id)) return false;

    // If the active item has a specific instanceId and the caller is also specifying an instanceId, they must match.
    // If the caller doesn't specify an instanceId (e.g. detail/reader page), it matches by ID + type.
    if (current.instanceId && instanceId && current.instanceId !== instanceId) {
      return false;
    }

    return true;
  }

  getCoverName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    return this.isActive(id, type, instanceId) ? 'cover-active' : 'none';
  }

  getTitleName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    return this.isActive(id, type, instanceId) ? 'title-active' : 'none';
  }

  getProgressName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    return this.isActive(id, type, instanceId) ? 'progress-active' : 'none';
  }
}

