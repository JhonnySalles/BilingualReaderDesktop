import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NavigationStackService {
  private readonly originLibraryId = signal('home');
  private readonly returnStack = signal<string[]>([]);

  rememberLibrary(libId: string): void {
    this.originLibraryId.set(libId || 'home');
  }

  libraryUrl(libId?: string): string {
    const id = libId ?? this.originLibraryId();
    return `/?lib=${encodeURIComponent(id || 'home')}`;
  }

  pushReturnUrl(url: string): void {
    const normalized = this.normalizeUrl(url);
    if (!normalized) return;
    const stack = this.returnStack();
    if (stack.length > 0 && stack[stack.length - 1] === normalized) return;
    this.returnStack.set([...stack, normalized]);
  }

  consumeReturnUrl(fallback?: string): string {
    const stack = this.returnStack();
    if (stack.length === 0) {
      return fallback ?? this.libraryUrl();
    }
    const next = stack[stack.length - 1];
    this.returnStack.set(stack.slice(0, -1));
    return next;
  }

  clearStack(): void {
    this.returnStack.set([]);
  }

  goBack(router: Router): void {
    void router.navigateByUrl(this.consumeReturnUrl());
  }

  goToLibrary(router: Router): void {
    this.clearStack();
    void router.navigateByUrl(this.libraryUrl());
  }

  openDetail(router: Router, type: 'manga' | 'book', id: number | string): void {
    this.pushReturnUrl(router.url);
    void router.navigate(['/detail', type, id]);
  }

  openReader(router: Router, kind: 'image' | 'text', id: number | string): void {
    this.pushReturnUrl(router.url);
    void router.navigate([kind === 'image' ? '/reader-image' : '/reader-text', id]);
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    // Router.url is already absolute path + query; strip accidental origin
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const u = new URL(url);
        return `${u.pathname}${u.search}` || '/';
      } catch {
        return url;
      }
    }
    return url.startsWith('/') ? url : `/${url}`;
  }
}
