import { Injectable, signal } from '@angular/core';

export interface SocialShareDialogOptions {
  initialMediaType?: 'MANGA' | 'BOOK' | 'ALL';
  initialYear?: number | null;
  initialLibraryId?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class SocialShareService {
  readonly activeOptions = signal<SocialShareDialogOptions | null>(null);
  readonly isOpen = signal<boolean>(false);

  open(options?: SocialShareDialogOptions): void {
    this.activeOptions.set(options ?? {});
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.activeOptions.set(null);
  }
}

