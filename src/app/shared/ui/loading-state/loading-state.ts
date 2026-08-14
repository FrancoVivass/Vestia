import { Component, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.css',
})
export class LoadingStateComponent implements OnInit, OnDestroy {
  @Input() label = 'Cargando...';
  private readonly el = inject(ElementRef);
  private anim: any;

  async ngOnInit(): Promise<void> {
    const lottie = await import('lottie-web');
    this.anim = lottie.default.loadAnimation({
      container: this.el.nativeElement.querySelector('#loading-lottie'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/loading.json',
    });
  }

  ngOnDestroy(): void {
    this.anim?.destroy();
  }
}
