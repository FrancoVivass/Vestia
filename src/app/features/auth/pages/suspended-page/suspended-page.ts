import { Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-suspended-page',
  imports: [],
  templateUrl: './suspended-page.html',
  styleUrl: './suspended-page.css',
})
export class SuspendedPageComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly el = inject(ElementRef);
  private anim: any;

  async ngOnInit(): Promise<void> {
    const lottie = await import('lottie-web');
    this.anim = lottie.default.loadAnimation({
      container: this.el.nativeElement.querySelector('#lottie-container'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/suspendida.json',
    });
  }

  ngOnDestroy(): void {
    this.anim?.destroy();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
