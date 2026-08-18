import { DatePipe, SlicePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../../../core/services/report.service';

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata: Record<string, any>;
  profiles?: any;
  actor_profile_id?: string;
}

@Component({
  selector: 'app-audit-page',
  imports: [DatePipe, SlicePipe, FormsModule],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.css',
})
export class AuditPageComponent implements OnInit {
  private readonly service = inject(ReportService);
  readonly rows = signal<AuditRow[]>([]);
  readonly loading = signal(true);
  readonly filterAction = signal('ALL');
  readonly filterEntity = signal('ALL');
  readonly searchQuery = signal('');
  readonly expandedId = signal<string | null>(null);

  readonly actions = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'OPEN', 'CLOSE', 'RETURN', 'EXCHANGE'];
  readonly entities = ['ALL', 'SALE', 'RETURN', 'PURCHASE', 'CASH_SESSION', 'PRODUCT', 'USER', 'OTHER'];

  readonly filteredRows = computed(() => {
    let data = this.rows();
    const action = this.filterAction();
    const entity = this.filterEntity();
    const q = this.searchQuery().toLowerCase();
    if (action !== 'ALL') data = data.filter(r => r.action === action);
    if (entity !== 'ALL') data = data.filter(r => r.entity_type === entity);
    if (q) data = data.filter(r =>
      r.entity_type?.toLowerCase().includes(q) ||
      r.action?.toLowerCase().includes(q) ||
      `${r.profiles?.first_name} ${r.profiles?.last_name}`.toLowerCase().includes(q) ||
      r.entity_id?.toLowerCase().includes(q)
    );
    return data;
  });

  readonly stats = computed(() => {
    const all = this.rows();
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = all.filter(r => r.created_at?.slice(0, 10) === today);
    return {
      total: all.length,
      today: todayRows.length,
      sales: all.filter(r => r.entity_type === 'SALE').length,
      returns: all.filter(r => r.entity_type === 'RETURN').length,
      purchases: all.filter(r => r.entity_type === 'PURCHASE').length,
    };
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.service.audit());
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  actionLabel(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó',
      CONFIRM: 'Confirmó', OPEN: 'Abrió', CLOSE: 'Cerró',
      RETURN: 'Devolución', EXCHANGE: 'Intercambio',
    };
    return map[action] ?? action;
  }

  actionColor(action: string): string {
    const map: Record<string, string> = {
      CREATE: '#10b981', UPDATE: '#3b82f6', DELETE: '#ef4444',
      CONFIRM: '#8b5cf6', OPEN: '#f59e0b', CLOSE: '#f97316',
      RETURN: '#ec4899', EXCHANGE: '#06b6d4',
    };
    return map[action] ?? '#6b7280';
  }

  entityLabel(type: string): string {
    const map: Record<string, string> = {
      SALE: 'Venta', RETURN: 'Devolución', PURCHASE: 'Compra',
      CASH_SESSION: 'Sesión de caja', PRODUCT: 'Producto',
      USER: 'Usuario', EXCHANGE: 'Intercambio', OTHER: 'Otro',
    };
    return map[type] ?? type;
  }

  entityIcon(type: string): string {
    const map: Record<string, string> = {
      SALE: '💰', RETURN: '↩️', PURCHASE: '📦',
      CASH_SESSION: '🏧', PRODUCT: '🏷️', USER: '👤',
      EXCHANGE: '🔄', OTHER: '📋',
    };
    return map[type] ?? '📋';
  }

  formatMetadata(metadata: Record<string, any> | null): string {
    if (!metadata || Object.keys(metadata).length === 0) return '';
    return Object.entries(metadata)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');
  }

  hasMetadata(metadata: Record<string, any> | null): boolean {
    return !!metadata && Object.keys(metadata).length > 0;
  }

  actorName(row: AuditRow): string {
    const p: any = row.profiles;
    if (Array.isArray(p)) return p.length ? `${p[0].first_name} ${p[0].last_name}`.trim() : 'Sistema';
    if (p) return `${p.first_name} ${p.last_name}`.trim();
    return 'Sistema';
  }
}
