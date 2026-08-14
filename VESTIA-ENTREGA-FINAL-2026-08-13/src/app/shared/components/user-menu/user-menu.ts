import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css',
})
export class UserMenuComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly userEmail = computed(() => this.authService.user()?.email ?? 'Usuario');
  readonly userInitial = computed(() => (this.userEmail().charAt(0) || 'U').toUpperCase());

  async logout(): Promise<void> {
    this.loading.set(true);

    try {
      await this.authService.logout();
      this.toast.show({
        title: 'Sesión cerrada',
        description: 'Tu sesión se cerró correctamente.',
        variant: 'success',
      });
      void this.router.navigate(['/login'], {
        queryParams: { reason: 'signed_out' },
      });
    } finally {
      this.loading.set(false);
    }
  }
}
