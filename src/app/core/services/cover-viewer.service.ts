import { Injectable, signal } from '@angular/core';

export interface CoverViewerOptions {
  coverUrl: string | null;
  backCoverUrl?: string | null;
  title?: string | null;
  isFullCover?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CoverViewerService {
  readonly activeViewer = signal<CoverViewerOptions | null>(null);

  open(options: CoverViewerOptions): void {
    this.activeViewer.set(options);
  }

  close(): void {
    this.activeViewer.set(null);
  }
}

