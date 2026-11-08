import { Directive, ElementRef, OnInit, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[appTeleportToBody]',
  standalone: true
})
export class TeleportToBodyDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private node: HTMLElement | null = null;

  ngOnInit(): void {
    this.node = this.el.nativeElement;
    if (this.node && this.node.parentElement !== document.body) {
      document.body.appendChild(this.node);
    }
  }

  ngOnDestroy(): void {
    if (this.node && this.node.parentElement === document.body) {
      this.node.remove();
    }
    this.node = null;
  }
}

