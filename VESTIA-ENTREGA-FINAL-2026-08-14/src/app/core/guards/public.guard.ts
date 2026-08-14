import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const publicGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  await authService.initialize();
  const session = await authService.getSession();

  if (!session) {
    return true;
  }

  return router.createUrlTree([authService.resolveRedirectUrl(session)]);
};
