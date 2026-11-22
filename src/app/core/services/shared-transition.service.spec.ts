import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SharedTransitionService } from './shared-transition.service';

@Component({
  standalone: true,
  template: `
    <div id="card1" [style.view-transition-name]="service.getCoverName('10', 'book', 'inst-1')"></div>
    <div id="card2" [style.view-transition-name]="service.getCoverName('10', 'book', 'inst-2')"></div>
    <div id="card3" [style.view-transition-name]="service.getCoverName('20', 'book', 'inst-3')"></div>
  `
})
class TestHostComponent {
  constructor(public service: SharedTransitionService) {}
}

describe('SharedTransitionService', () => {
  let service: SharedTransitionService;
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [SharedTransitionService]
    }).compileComponents();

    service = TestBed.inject(SharedTransitionService);
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should return none when no active item is set', () => {
    expect(service.getCoverName('10', 'book', 'inst-1')).toBe('none');
    expect(service.getTitleName('10', 'book', 'inst-1')).toBe('none');
    expect(service.getProgressName('10', 'book', 'inst-1')).toBe('none');
  });

  it('should return transition names strictly matching instanceId without scheduling microtasks', () => {
    service.setActiveItem('book', '10', 'inst-1');
    fixture.detectChanges();

    const hostEl: HTMLElement = fixture.nativeElement;
    const card1 = hostEl.querySelector('#card1') as HTMLElement;
    const card2 = hostEl.querySelector('#card2') as HTMLElement;
    const card3 = hostEl.querySelector('#card3') as HTMLElement;

    expect(card1.style.viewTransitionName).toBe('cover-active');
    expect(card2.style.viewTransitionName).toBe('none');
    expect(card3.style.viewTransitionName).toBe('none');
  });

  it('should clear active item and reset transition names cleanly', () => {
    service.setActiveItem('book', '10', 'inst-1');
    fixture.detectChanges();
    expect(service.getCoverName('10', 'book', 'inst-1')).toBe('cover-active');

    service.clearActiveItem();
    fixture.detectChanges();

    const hostEl: HTMLElement = fixture.nativeElement;
    const card1 = hostEl.querySelector('#card1') as HTMLElement;
    expect(card1.style.viewTransitionName).toBe('none');
  });
});

