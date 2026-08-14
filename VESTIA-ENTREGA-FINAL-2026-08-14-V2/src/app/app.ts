import { Component, DestroyRef, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ConfirmationDialogComponent } from './shared/ui/confirmation-dialog/confirmation-dialog';
import { ToastComponent } from './shared/ui/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ConfirmationDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly title = 'VESTIA';

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    void this.authService.initialize();

    const subscription = this.authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void this.router.navigate(['/login'], {
          queryParams: { reason: 'signed_out' },
        });
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        void this.router.navigate(['/login'], {
          queryParams: { reason: 'session_expired' },
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }
}
