import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  await authService.initialize();
  const session = await authService.getSession();

  if (session) {
    if(await authService.isPlatformOwner()&&state.url.startsWith('/app')){
      return router.createUrlTree(['/platform/comercios']);
    }
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url, reason: 'unauthorized' },
  });
};
