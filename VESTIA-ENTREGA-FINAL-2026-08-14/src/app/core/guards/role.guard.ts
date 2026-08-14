import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const permissionService = inject(PermissionService);
  const expectedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

  if (!expectedRoles.length || expectedRoles.some((role) => permissionService.hasRole(role))) {
    return true;
  }

  return router.createUrlTree(['/app']);
};
