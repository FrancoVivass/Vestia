import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { BusinessContextService } from '../../core/services/business-context.service';
import { NavigationService } from '../../core/services/navigation.service';
import { ThemeService } from '../../core/services/theme.service';
import { CashService } from '../../core/services/cash.service';
import { AuthService } from '../../core/services/auth.service';
import { DataAccessService } from '../../core/services/data-access.service';
import { ToastService } from '../../core/services/toast.service';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { SuspendedPageComponent } from '../../features/auth/pages/suspended-page/suspended-page';

@Component({
  selector: 'app-dashboard-layout',
  imports: [FormsModule, RouterOutlet, HeaderComponent, SidebarComponent, SuspendedPageComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent implements OnInit {
  protected readonly navigation = inject(NavigationService);
  protected readonly theme = inject(ThemeService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly cash = inject(CashService);
  private readonly auth = inject(AuthService);
  private readonly data = inject(DataAccessService);
  private readonly toast = inject(ToastService);
  protected readonly router = inject(Router);

  readonly isSuspended = computed(() => {
    const business = this.businessContext.activeBusiness();
    return business !== null && !business.isActive;
  });

  readonly showCashPrompt = signal(false);
  readonly isPlatformOwner = signal(false);
  readonly hasOpenCash = signal(false);
  readonly showOpenCashModal = signal(false);
  readonly registers = signal<any[]>([]);
  registerId = '';
  opening = 0;

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
      } else {
        this.hasOpenCash.set(true);
      }
    } catch {
      this.showCashPrompt.set(true);
    }

    await this.loadRegisters();
  }

  async loadRegisters(): Promise<void> {
    try {
      const r = await this.data.list<any>('cash_registers', { active: true });
      this.registers.set(r.items);
      if (r.items.length) this.registerId = r.items[0].id;
    } catch {}
  }

  openCaja(): void {
    this.showCashPrompt.set(false);
    void this.router.navigate(['/app/caja']);
  }

  dismissCashPrompt(): void {
    this.showCashPrompt.set(false);
  }

  openOpenCashModal(): void {
    this.showOpenCashModal.set(true);
  }

  async confirmOpenCash(): Promise<void> {
    if (!this.registerId) return;
    try {
      await this.cash.open(this.registerId, Number(this.opening));
      this.toast.show({ title: 'Caja abierta', variant: 'success' });
      this.hasOpenCash.set(true);
      this.showOpenCashModal.set(false);
      this.showCashPrompt.set(false);
    } catch (e) {
      this.toast.show({
        title: 'No se pudo abrir la caja',
        description: e instanceof Error ? e.message : 'Error inesperado',
        variant: 'danger',
      });
    }
  }
}
