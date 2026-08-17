import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BusinessContextService } from '../../core/services/business-context.service';
import { NavigationService } from '../../core/services/navigation.service';
import { ThemeService } from '../../core/services/theme.service';
import { CashService } from '../../core/services/cash.service';
import { AuthService } from '../../core/services/auth.service';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { SuspendedPageComponent } from '../../features/auth/pages/suspended-page/suspended-page';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, SuspendedPageComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent implements OnInit {
  protected readonly navigation = inject(NavigationService);
  protected readonly theme = inject(ThemeService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly cash = inject(CashService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSuspended = computed(() => {
    const business = this.businessContext.activeBusiness();
    return business !== null && !business.isActive;
  });

  readonly showCashPrompt = signal(false);
  readonly isPlatformOwner = signal(false);

  async ngOnInit(): Promise<void> {
    const session = this.auth.session();
    if (session?.user.app_metadata['platform_owner'] === true) {
      this.isPlatformOwner.set(true);
      return;
    }

    try {
      const currentSession = await this.cash.current();
      if (!currentSession) {
        this.showCashPrompt.set(true);
      }
    } catch {
      this.showCashPrompt.set(true);
    }
  }

  openCaja(): void {
    this.showCashPrompt.set(false);
    void this.router.navigate(['/app/caja']);
  }

  dismissCashPrompt(): void {
    this.showCashPrompt.set(false);
  }
}
