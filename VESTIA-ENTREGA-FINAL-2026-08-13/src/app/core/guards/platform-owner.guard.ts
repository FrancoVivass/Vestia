import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const platformOwnerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initialize();
  return await auth.isPlatformOwner() ? true : router.createUrlTree(['/app']);
};
