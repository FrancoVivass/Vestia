import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BusinessContextService } from '../../core/services/business-context.service';
import { NavigationService } from '../../core/services/navigation.service';
import { ThemeService } from '../../core/services/theme.service';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { SuspendedPageComponent } from '../../features/auth/pages/suspended-page/suspended-page';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, SuspendedPageComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent {
  protected readonly navigation = inject(NavigationService);
  protected readonly theme = inject(ThemeService);
  private readonly businessContext = inject(BusinessContextService);

  readonly isSuspended = computed(() => {
    const business = this.businessContext.activeBusiness();
    return business !== null && !business.isActive;
  });
}
