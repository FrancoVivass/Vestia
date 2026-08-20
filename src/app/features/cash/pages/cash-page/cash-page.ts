import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CashService, CashSummary, CashCloseReport } from '../../../../core/services/cash.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-cash-page',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './cash-page.html',
  styleUrl: './cash-page.css',
})
export class CashPageComponent implements OnInit {
  private readonly cash = inject(CashService);
  private readonly data = inject(DataAccessService);
  private readonly toast = inject(ToastService);

  readonly session = signal<any>(null);
  readonly summary = signal<CashSummary | null>(null);
  readonly registers = signal<any[]>([]);
  readonly reports = signal<CashCloseReport[]>([]);
  readonly loading = signal(false);
  readonly showHistory = signal(false);
  readonly showConfirmClose = signal(false);
  readonly showOpenModal = signal(false);

  registerId = '';
  opening = 0;
  counted = 0;
  notes = '';

  readonly expectedCash = computed(() => this.summary()?.expectedCash ?? 0);
  readonly difference = computed(() => {
    const expected = this.expectedCash();
    const counted = Number(this.counted);
    return counted - expected;
  });

  readonly reportsWithShortage = computed(() => this.reports().filter(r => r.difference < 0).length);
  readonly reportsWithSurplus = computed(() => this.reports().filter(r => r.difference > 0).length);
  readonly totalDifference = computed(() => this.reports().reduce((s, r) => s + r.difference, 0));

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [r, s, reports] = await Promise.all([
        this.data.list<any>('cash_registers', { active: true }),
        this.cash.current(),
        this.cash.closeReports(),
      ]);
      this.registers.set(r.items);
      this.session.set(s);
      this.summary.set(s ? await this.cash.summary(s.id) : null);
      this.reports.set(reports);
      if (!this.registerId && r.items.length) this.registerId = r.items[0].id;
    } finally {
      this.loading.set(false);
    }
  }

  async open(): Promise<void> {
    try {
      await this.cash.open(this.registerId, Number(this.opening));
      this.toast.show({ title: 'Caja abierta', variant: 'success' });
      await this.load();
    } catch (e) {
      this.fail(e);
    }
  }

  openConfirmClose(): void {
    this.showConfirmClose.set(true);
  }

  cancelClose(): void {
    this.showConfirmClose.set(false);
  }

  async confirmClose(): Promise<void> {
    this.showConfirmClose.set(false);
    if (!this.session()) return;
    try {
      await this.cash.close(this.session().id, Number(this.counted), this.notes);
      this.toast.show({ title: 'Caja cerrada correctamente', variant: 'success' });
      await this.load();
    } catch (e) {
      this.fail(e);
    }
  }

  toggleHistory(): void {
    this.showHistory.update(v => !v);
  }

  private fail(e: unknown): void {
    this.toast.show({
      title: 'No se pudo operar la caja',
      description: e instanceof Error ? e.message : 'Error inesperado',
      variant: 'danger',
    });
  }
}
