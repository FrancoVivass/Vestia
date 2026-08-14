import { Component, computed, inject } from '@angular/core';
import { BusinessContextService } from '../../../core/services/business-context.service';
import { NavigationService } from '../../../core/services/navigation.service';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb';
import { NotificationMenuComponent } from '../notification-menu/notification-menu';
import { UserMenuComponent } from '../user-menu/user-menu';

@Component({
  selector: 'app-header',
  imports: [BreadcrumbComponent, NotificationMenuComponent, UserMenuComponent],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  private readonly navigation = inject(NavigationService);
  protected readonly businessContext = inject(BusinessContextService);
  protected readonly activeBusinessName = computed(
    () => this.businessContext.activeBusiness()?.name ?? null
  );
  protected readonly activeBusinessLogo = computed(() => this.businessContext.activeBusiness()?.logoUrl ?? null);

  toggleSidebar(): void {
    this.navigation.toggleSidebar();
  }

  clearBusinessContext(): void {
    this.businessContext.clear();
  }
}
