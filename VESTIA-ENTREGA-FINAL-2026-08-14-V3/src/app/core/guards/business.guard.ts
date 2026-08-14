import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessContextService } from '../services/business-context.service';
import { PermissionService } from '../services/permission.service';

export const businessGuard: CanActivateFn = () => {
  const router = inject(Router);
  const businessContext = inject(BusinessContextService);
  const permissionService = inject(PermissionService);

  if (permissionService.isSuperAdmin() || businessContext.activeBusiness()) {
    return true;
  }

  return router.createUrlTree(['/app/admin']);
};
