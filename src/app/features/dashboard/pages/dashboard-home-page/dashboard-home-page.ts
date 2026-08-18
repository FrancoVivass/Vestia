import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CashSummary, CashCloseReport, CashService } from '../../../../core/services/cash.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InventoryRow, SaleListRow } from '../../../../core/models/domain.model';
import { InventoryService } from '../../../../core/services/inventory.service';
import { DashboardMetrics, OwnerSalesRow, ReportService } from '../../../../core/services/report.service';
import { SaleService } from '../../../../core/services/sale.service';

interface ChartPoint { date: string; amount: number; height: number; }

@Component({
  selector: 'app-dashboard-home-page',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './dashboard-home-page.html',
  styleUrl: './dashboard-home-page.css',
})
export class DashboardHomePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly reports = inject(ReportService);
  private readonly inventoryService = inject(InventoryService);
  private readonly salesService = inject(SaleService);
  private readonly cash = inject(CashService);
  readonly router = inject(Router);

  readonly metrics = signal<DashboardMetrics | null>(null);
  readonly inventory = signal<InventoryRow[]>([]);
  readonly recentSales = signal<SaleListRow[]>([]);
  readonly ownerSales = signal<OwnerSalesRow[]>([]);
  readonly cashSummary = signal<CashSummary | null>(null);
  readonly closeReports = signal<CashCloseReport[]>([]);
  readonly loading = signal(false);

  readonly cashShortages = computed(() => this.closeReports().filter(r => r.difference < 0).slice(0, 3));
  readonly totalCashShortage = computed(() => {
    const total = this.closeReports().filter(r => r.difference < 0).reduce((s, r) => s + r.difference, 0);
    return total;
  });

  readonly currentUserEmail = computed(() => this.auth.user()?.email ?? '');
  readonly outOfStock = computed(() => this.inventory().filter(r => r.quantity === 0).length);
  readonly lowStock = computed(() => this.inventory().filter(r => r.quantity > 0 && r.quantity <= r.minimumStock).slice(0, 5));
  readonly unitsSold = computed(() => this.ownerSales().reduce((s, r) => s + Number(r.units), 0));
  readonly estimatedProfit = computed(() => this.ownerSales().reduce((s, r) => s + Number(r.estimated_profit), 0));

  readonly chart = computed<ChartPoint[]>(() => {
    const days = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of this.ownerSales()) {
      const key = row.sale_day.slice(0, 10);
      if (days.has(key)) days.set(key, (days.get(key) ?? 0) + Number(row.gross_sales));
    }
    const max = Math.max(...days.values(), 1);
    return [...days].map(([date, amount]) => ({
      date,
      amount,
      height: Math.max(4, Math.round((amount / max) * 100)),
    }));
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly userName = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.split('@')[0] || 'Usuario';
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const to = new Date().toISOString().slice(0, 10);
      const [metrics, inventory, recentSales, ownerSales, session, reports] = await Promise.all([
        this.reports.dashboard(),
        this.inventoryService.list(),
        this.salesService.recent(),
        this.reports.owners(from.toISOString().slice(0, 10), to),
        this.cash.current(),
        this.cash.closeReports(),
      ]);
      this.metrics.set(metrics);
      this.inventory.set(inventory);
      this.recentSales.set(recentSales.slice(0, 6));
      this.ownerSales.set(ownerSales);
      this.cashSummary.set(session ? await this.cash.summary(session.id) : null);
      this.closeReports.set(reports);
    } finally {
      this.loading.set(false);
    }
  }

  saleStatusLabel(status: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'Completada', PENDING: 'Pendiente', CANCELLED: 'Cancelada',
      PARTIALLY_RETURNED: 'Devolución parcial', RETURNED: 'Devuelta',
    };
    return map[status] ?? status;
  }
}
