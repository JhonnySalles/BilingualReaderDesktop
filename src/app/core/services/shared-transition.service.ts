import { Injectable, signal } from '@angular/core';

export type TransitionItemType = 'manga' | 'book' | 'history';

@Injectable({
  providedIn: 'root'
})
export class SharedTransitionService {
  /** The item currently selected/active for transition */
  private readonly activeItem = signal<{ type: TransitionItemType; id: string; instanceId?: string } | null>(null);

  /** Map of claimed transition names in the current microtask tick to enforce uniqueness per document */
  private readonly claimedNames = new Map<string, string>();
  private tickScheduled = false;

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

    // If active item already has an instanceId and caller provides an instanceId, they must match.
    if (current.instanceId && instanceId && current.instanceId !== instanceId) {
      return false;
    }

    // If active item had no instanceId, bind to the first caller with an instanceId to avoid duplicates across repeated cards
    if (!current.instanceId && instanceId) {
      current.instanceId = instanceId;
    }

    return true;
  }

  private claimName(name: string, instanceId?: string): string {
    if (!this.tickScheduled) {
      this.tickScheduled = true;
      queueMicrotask(() => {
        this.claimedNames.clear();
        this.tickScheduled = false;
      });
    }

    const key = instanceId ? `${name}::${instanceId}` : name;
    const alreadyClaimedBy = this.claimedNames.get(name);

    // If another element with a different instanceId already claimed this name in this tick, return 'none' to prevent duplicate view-transition-name
    if (alreadyClaimedBy && alreadyClaimedBy !== key) {
      return 'none';
    }

    this.claimedNames.set(name, key);
    return name;
  }

  getCoverName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    if (!this.isActive(id, type, instanceId)) return 'none';
    return this.claimName('cover-active', instanceId);
  }

  getTitleName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    if (!this.isActive(id, type, instanceId)) return 'none';
    return this.claimName('title-active', instanceId);
  }

  getProgressName(id: number | string | undefined | null, type?: TransitionItemType, instanceId?: string): string {
    if (!this.isActive(id, type, instanceId)) return 'none';
    return this.claimName('progress-active', instanceId);
  }
}

