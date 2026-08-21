import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ReportService, OwnerSalesRow } from '../../../../core/services/report.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { ToastService } from '../../../../core/services/toast.service';

type Period = 'week' | 'month' | 'quarter';

interface OwnerStats {
  id: string;
  name: string;
  initial: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  totalUnits: number;
  avgDaily: number;
  days: number;
}

@Component({
  selector: 'app-owners-stats-page',
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './owners-stats-page.html',
  styleUrl: './owners-stats-page.css',
})
export class OwnersStatsPageComponent implements OnInit {
  private readonly reports = inject(ReportService);
  private readonly data = inject(DataAccessService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly period = signal<Period>('month');
  readonly ownerSales = signal<OwnerSalesRow[]>([]);
  readonly owners = signal<any[]>([]);

  readonly dateRange = computed(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from: string;
    const p = this.period();
    if (p === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
    } else if (p === 'month') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      from = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      from = d.toISOString().slice(0, 10);
    }
    return { from, to };
  });

  readonly ownerStats = computed<OwnerStats[]>(() => {
    const sales = this.ownerSales();
    const map = new Map<string, OwnerStats>();

    for (const row of sales) {
      const existing = map.get(row.owner_id);
      if (existing) {
        existing.totalSales += Number(row.gross_sales);
        existing.totalCost += Number(row.cost);
        existing.totalProfit += Number(row.estimated_profit);
        existing.totalUnits += Number(row.units);
      } else {
        map.set(row.owner_id, {
          id: row.owner_id,
          name: `${row.owner_first_name} ${row.owner_last_name}`,
          initial: (row.owner_last_name || row.owner_first_name || '?').charAt(0).toUpperCase(),
          totalSales: Number(row.gross_sales),
          totalCost: Number(row.cost),
          totalProfit: Number(row.estimated_profit),
          totalUnits: Number(row.units),
          avgDaily: 0,
          days: 0,
        });
      }
    }

    const range = this.dateRange();
    const daysDiff = Math.max(1, Math.ceil((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000));

    for (const stats of map.values()) {
      stats.avgDaily = stats.totalProfit / daysDiff;
    }

    return [...map.values()].sort((a, b) => b.totalProfit - a.totalProfit);
  });

  readonly totalSales = computed(() => this.ownerStats().reduce((s, o) => s + o.totalSales, 0));
  readonly totalProfit = computed(() => this.ownerStats().reduce((s, o) => s + o.totalProfit, 0));
  readonly totalUnits = computed(() => this.ownerStats().reduce((s, o) => s + o.totalUnits, 0));

  readonly dailyData = computed(() => {
    const sales = this.ownerSales();
    const byDay = new Map<string, Map<string, number>>();

    for (const row of sales) {
      const day = row.sale_day.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, new Map());
      byDay.get(day)!.set(row.owner_id, (byDay.get(day)!.get(row.owner_id) ?? 0) + Number(row.gross_sales));
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, owners]) => ({ date, owners: [...owners.entries()] }));
  });

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const range = this.dateRange();
      const [sales, ownerList] = await Promise.all([
        this.reports.owners(range.from, range.to),
        this.data.list<any>('owners', { active: true }),
      ]);
      this.ownerSales.set(sales);
      this.owners.set(ownerList.items);
    } catch (e) {
      this.toast.show({
        title: 'Error al cargar estadísticas',
        description: e instanceof Error ? e.message : 'Error inesperado',
        variant: 'danger',
      });
    } finally {
      this.loading.set(false);
    }
  }

  setPeriod(p: Period) {
    this.period.set(p);
    void this.load();
  }

  profitPercent(profit: number, sales: number): number {
    return sales > 0 ? Math.round((profit / sales) * 100) : 0;
  }
}
