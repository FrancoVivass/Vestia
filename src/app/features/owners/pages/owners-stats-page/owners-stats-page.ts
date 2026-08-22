import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ReportService, OwnerSalesRow } from '../../../../core/services/report.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { ToastService } from '../../../../core/services/toast.service';

type Period = 'day' | 'week' | 'month' | 'quarter';

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

interface TimeSlice {
  label: string;
  dateKey: string;
  owners: { id: string; name: string; initial: string; sales: number; profit: number; units: number }[];
  totalProfit: number;
  totalSales: number;
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

  readonly Math = Math;

  readonly loading = signal(false);
  readonly period = signal<Period>('month');
  readonly ownerSales = signal<OwnerSalesRow[]>([]);
  readonly owners = signal<any[]>([]);

  readonly dateRange = computed(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from: string;
    const p = this.period();
    if (p === 'day') {
      from = to;
    } else if (p === 'week') {
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

  readonly timeSlices = computed<TimeSlice[]>(() => {
    const sales = this.ownerSales();
    const p = this.period();
    const grouped = new Map<string, Map<string, { sales: number; profit: number; units: number }>>();

    for (const row of sales) {
      const raw = row.sale_day;
      let key: string;

      if (p === 'day') {
        key = raw.slice(0, 13);
      } else if (p === 'week' || p === 'month') {
        key = raw.slice(0, 10);
      } else {
        const d = new Date(raw);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().slice(0, 10);
      }

      if (!grouped.has(key)) grouped.set(key, new Map());
      const ownerMap = grouped.get(key)!;
      const existing = ownerMap.get(row.owner_id);
      if (existing) {
        existing.sales += Number(row.gross_sales);
        existing.profit += Number(row.estimated_profit);
        existing.units += Number(row.units);
      } else {
        ownerMap.set(row.owner_id, {
          sales: Number(row.gross_sales),
          profit: Number(row.estimated_profit),
          units: Number(row.units),
        });
      }
    }

    const ownerMapGlobal = new Map<string, { name: string; initial: string }>();
    for (const row of sales) {
      if (!ownerMapGlobal.has(row.owner_id)) {
        ownerMapGlobal.set(row.owner_id, {
          name: `${row.owner_first_name} ${row.owner_last_name}`,
          initial: (row.owner_last_name || row.owner_first_name || '?').charAt(0).toUpperCase(),
        });
      }
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, ownerData]) => {
        const owners = [...ownerData.entries()].map(([id, d]) => ({
          id,
          name: ownerMapGlobal.get(id)?.name ?? id,
          initial: ownerMapGlobal.get(id)?.initial ?? '?',
          ...d,
        }));
        const totalProfit = owners.reduce((s, o) => s + o.profit, 0);
        const totalSales = owners.reduce((s, o) => s + o.sales, 0);
        return { label: this.formatSliceLabel(dateKey, p), dateKey, owners, totalProfit, totalSales };
      });
  });

  readonly maxSliceProfit = computed(() => {
    const slices = this.timeSlices();
    if (slices.length === 0) return 1;
    return Math.max(1, ...slices.map(s => Math.abs(s.totalProfit)));
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

  getOwnerSlice(slice: TimeSlice, ownerId: string) {
    return slice.owners.find(o => o.id === ownerId);
  }

  private formatSliceLabel(key: string, p: Period): string {
    if (p === 'day') {
      const hour = key.slice(11, 13);
      return `${parseInt(hour, 10)}:00`;
    }
    if (p === 'week' || p === 'month') {
      const d = new Date(key + 'T12:00:00');
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return `${dayNames[d.getDay()]} ${d.getDate()}`;
    }
    const d = new Date(key + 'T12:00:00');
    return `Sem ${d.getDate()}/${d.getMonth() + 1}`;
  }
}
