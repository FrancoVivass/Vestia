import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExpenseRecord, PaymentMethodRecord, PhysicalInventory, PhysicalInventoryItem } from '../../../../core/models/domain.model';
import { CashService } from '../../../../core/services/cash.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ToastService } from '../../../../core/services/toast.service';

type OpsTab = 'inventory' | 'expenses' | 'movements';

interface OwnerOption { id: string; first_name: string; last_name: string; active: boolean; }

@Component({
  selector: 'app-operations-page',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './operations-page.html',
  styleUrl: './operations-page.css',
})
export class OperationsPageComponent implements OnInit {
  private readonly client = inject(SupabaseService).client;
  private readonly inventoryService = inject(InventoryService);
  private readonly cash = inject(CashService);
  private readonly data = inject(DataAccessService);
  private readonly toast = inject(ToastService);

  readonly inventory = signal<PhysicalInventory | null>(null);
  readonly counts = signal<Record<string, number | null>>({});
  readonly session = signal<{ id: string } | null>(null);
  readonly owners = signal<OwnerOption[]>([]);
  readonly methods = signal<PaymentMethodRecord[]>([]);
  readonly expenses = signal<ExpenseRecord[]>([]);
  readonly loading = signal(false);
  readonly activeTab = signal<OpsTab>('inventory');

  inventoryNotes = '';
  expenseConcept = '';
  expenseCategory = 'General';
  expenseAmount = 0;
  expenseMethodId = '';
  expenseOwnerId = '';
  expenseNotes = '';
  expenseDate = new Date().toISOString().slice(0, 16);
  movementType: 'INCOME' | 'WITHDRAWAL' = 'INCOME';
  movementAmount = 0;
  movementDescription = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [inventory, session, owners, methods, expenses] = await Promise.all([
        this.inventoryService.currentPhysicalInventory(),
        this.cash.current(),
        this.data.list<OwnerOption>('owners', { pageSize: 200, active: true }),
        this.data.list<PaymentMethodRecord>('payment_methods', { pageSize: 100, active: true }),
        this.cash.recentExpenses(),
      ]);
      this.inventory.set(inventory);
      this.session.set(session);
      this.owners.set(owners.items);
      this.methods.set(methods.items);
      this.expenses.set(expenses);
      this.counts.set(Object.fromEntries(
        (inventory?.physical_inventory_items ?? []).map(item => [this.key(item), item.counted_quantity])
      ));
      if (!this.expenseMethodId)
        this.expenseMethodId = methods.items.find(m => m.code === 'CASH')?.id ?? methods.items[0]?.id ?? '';
    } catch (error) {
      this.fail('No se pudieron cargar las operaciones', error);
    } finally {
      this.loading.set(false);
    }
  }

  async startInventory(): Promise<void> {
    if (!confirm('Se guardará una foto del stock actual para comenzar el conteo físico. ¿Continuar?')) return;
    this.loading.set(true);
    try {
      await this.inventoryService.startPhysicalInventory(this.inventoryNotes);
      this.inventoryNotes = '';
      await this.load();
      this.toast.show({ title: 'Inventario físico iniciado', variant: 'success' });
    } catch (error) {
      this.fail('No se pudo iniciar el inventario', error);
    } finally {
      this.loading.set(false);
    }
  }

  setCount(item: PhysicalInventoryItem, value: number | null): void {
    this.counts.update(c => ({ ...c, [this.key(item)]: value === null ? null : Number(value) }));
  }

  count(item: PhysicalInventoryItem): number | null {
    return this.counts()[this.key(item)] ?? null;
  }

  difference(item: PhysicalInventoryItem): number | null {
    const value = this.count(item);
    return value === null ? null : value - item.expected_quantity;
  }

  async saveCounts(showToast = true): Promise<boolean> {
    const current = this.inventory();
    if (!current) return false;
    const missing = current.physical_inventory_items.filter(item => this.count(item) === null || Number.isNaN(this.count(item)));
    if (missing.length) {
      this.toast.show({ title: `Faltan contar ${missing.length} combinaciones`, variant: 'warning' });
      return false;
    }
    this.loading.set(true);
    try {
      for (const item of current.physical_inventory_items) {
        await this.inventoryService.setPhysicalCount(current.id, item.variant_id, item.owner_id, Number(this.count(item)));
      }
      if (showToast) this.toast.show({ title: 'Conteo guardado', variant: 'success' });
      return true;
    } catch (error) {
      this.fail('No se pudo guardar el conteo', error);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async completeInventory(): Promise<void> {
    if (!await this.saveCounts(false)) return;
    if (!confirm('Se aplicarán los ajustes de stock según las diferencias contadas. Esta acción quedará auditada. ¿Continuar?')) return;
    const current = this.inventory();
    if (!current) return;
    this.loading.set(true);
    try {
      const adjustments = await this.inventoryService.completePhysicalInventory(current.id);
      await this.load();
      this.toast.show({ title: 'Inventario completado', description: `Se aplicaron ${adjustments} ajustes.`, variant: 'success' });
    } catch (error) {
      this.fail('No se pudo completar el inventario', error);
    } finally {
      this.loading.set(false);
    }
  }

  async registerExpense(): Promise<void> {
    const session = this.session();
    if (!session) {
      this.toast.show({ title: 'Abrí una caja antes de registrar el gasto', variant: 'warning' });
      return;
    }
    if (!this.expenseConcept.trim() || !this.expenseCategory.trim() || this.expenseAmount <= 0) {
      this.toast.show({ title: 'Completá concepto, categoría e importe', variant: 'warning' });
      return;
    }
    this.loading.set(true);
    try {
      await this.cash.registerExpense({
        sessionId: session.id, concept: this.expenseConcept, category: this.expenseCategory,
        amount: Number(this.expenseAmount), paymentMethodId: this.expenseMethodId || null,
        ownerId: this.expenseOwnerId || null, notes: this.expenseNotes,
        occurredAt: new Date(this.expenseDate).toISOString(),
      });
      this.expenseConcept = '';
      this.expenseAmount = 0;
      this.expenseNotes = '';
      this.expenseOwnerId = '';
      await this.load();
      this.toast.show({ title: 'Gasto registrado', description: 'Vinculado a la caja y al dueño indicado.', variant: 'success' });
    } catch (error) {
      this.fail('No se pudo registrar el gasto', error);
    } finally {
      this.loading.set(false);
    }
  }

  async registerMovement(): Promise<void> {
    const session = this.session();
    if (!session) {
      this.toast.show({ title: 'No hay una caja abierta', variant: 'warning' });
      return;
    }
    if (this.movementAmount <= 0 || !this.movementDescription.trim()) {
      this.toast.show({ title: 'Completá el importe y la descripción', variant: 'warning' });
      return;
    }
    this.loading.set(true);
    try {
      const { error } = await this.client.rpc('register_cash_movement', {
        p_session: session.id, p_type: this.movementType,
        p_amount: Number(this.movementAmount), p_description: this.movementDescription,
      });
      if (error) throw error;
      this.movementAmount = 0;
      this.movementDescription = '';
      this.toast.show({ title: 'Movimiento registrado', variant: 'success' });
    } catch (error) {
      this.fail('No se pudo registrar el movimiento', error);
    } finally {
      this.loading.set(false);
    }
  }

  ownerName(expense: ExpenseRecord): string {
    return expense.owners ? `${expense.owners.first_name} ${expense.owners.last_name}` : 'General';
  }

  private key(item: PhysicalInventoryItem): string {
    return `${item.variant_id}|${item.owner_id}`;
  }

  private fail(title: string, error: unknown): void {
    this.toast.show({ title, description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
  }
}
