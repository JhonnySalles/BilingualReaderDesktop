import { Component, HostListener, inject, OnInit, NgZone } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavigationStackService } from './core/services/navigation-stack.service';
import { ElectronService } from './core/services/electron.service';

import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { CoverViewerDialogComponent } from './shared/cover-viewer-dialog/cover-viewer-dialog.component';
import { SocialShareDialogComponent } from './shared/social-share-dialog/social-share-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, CoverViewerDialogComponent, SocialShareDialogComponent],
  template: `
    <router-outlet />
    <app-confirm-dialog />
    <app-cover-viewer-dialog />
    <app-social-share-dialog />
  `
})
export class AppComponent implements OnInit {
  title = 'bilingual-reader-desktop';

  private router = inject(Router);
  private nav = inject(NavigationStackService);
  private electronService = inject(ElectronService);
  private ngZone = inject(NgZone);

  ngOnInit(): void {
    this.electronService.onNavigate((routePath: string) => {
      this.ngZone.run(() => {
        void this.router.navigateByUrl(routePath);
      });
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Escape' && ev.key !== 'Backspace') return;
    if (this.isEditableTarget(ev.target)) return;

    if (ev.key === 'Escape' && document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    if (!this.nav.canGoBack()) return;

    ev.preventDefault();
    this.nav.goBack(this.router);
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }
}
