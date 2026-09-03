import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { InventoryRow } from '../../../../core/models/domain.model';
import { InventoryService } from '../../../../core/services/inventory.service';
import { CatalogRealtimeService } from '../../../../core/services/catalog-realtime.service';

@Component({
  selector: 'app-inventory-page',
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.css',
})
export class InventoryPageComponent implements OnInit, OnDestroy {
  private readonly service = inject(InventoryService);
  private readonly realtime = inject(CatalogRealtimeService);
  private stopRealtime: (() => void) | null = null;
  readonly rows = signal<InventoryRow[]>([]);
  readonly loading = signal(false);
  search = '';
  ownerFilter = signal('');

  readonly owners = computed(() => {
    const map = new Map<string, { id: string; name: string; total: number }>();
    for (const r of this.rows()) {
      if (!r.ownerId) continue;
      const existing = map.get(r.ownerId);
      if (existing) {
        existing.total += r.quantity;
      } else {
        map.set(r.ownerId, { id: r.ownerId, name: r.ownerName, total: r.quantity });
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });

  readonly filteredRows = computed(() => {
    const owner = this.ownerFilter();
    if (!owner) return this.rows();
    return this.rows().filter(r => r.ownerId === owner);
  });

  readonly groupedByOwner = computed(() => {
    const groups = new Map<string, { name: string; rows: InventoryRow[]; total: number }>();
    for (const r of this.filteredRows()) {
      const key = r.ownerId || 'sin-dueño';
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(r);
        existing.total += r.quantity;
      } else {
        groups.set(key, { name: r.ownerName || 'Sin dueño', rows: [r], total: r.quantity });
      }
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  });

  async ngOnInit() {
    this.stopRealtime = this.realtime.subscribe(() => this.load(false));
    await this.load();
  }

  ngOnDestroy(): void {
    this.stopRealtime?.();
  }

  async load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    try { this.rows.set(await this.service.list(this.search)); }
    finally { if (showLoading) this.loading.set(false); }
  }

  state(r: InventoryRow) {
    return r.quantity === 0 ? 'SIN STOCK' : r.quantity <= r.minimumStock ? 'STOCK BAJO' : 'EN STOCK';
  }

  total() { return this.filteredRows().reduce((sum, row) => sum + row.quantity, 0); }

  ownerInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }
}
