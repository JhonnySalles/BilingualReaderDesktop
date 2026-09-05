import { Component, HostListener, inject, OnInit, NgZone } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NavigationStackService } from './core/services/navigation-stack.service';
import { ElectronService } from './core/services/electron.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
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
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }
}
