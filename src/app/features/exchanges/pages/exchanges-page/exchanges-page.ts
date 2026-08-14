import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryRow } from '../../../../core/models/domain.model';
import { CashService } from '../../../../core/services/cash.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { ExchangeService } from '../../../../core/services/exchange.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { ReturnService } from '../../../../core/services/return.service';
import { ToastService } from '../../../../core/services/toast.service';

interface PaymentMethod { id: string; name: string }

@Component({
  selector: 'app-exchanges-page',
  imports: [FormsModule],
  templateUrl: './exchanges-page.html',
  styleUrl: './exchanges-page.css',
})
export class ExchangesPageComponent {
  private readonly returns = inject(ReturnService);
  private readonly inventory = inject(InventoryService);
  private readonly cash = inject(CashService);
  private readonly data = inject(DataAccessService);
  private readonly service = inject(ExchangeService);
  private readonly toast = inject(ToastService);

  readonly sale = signal<any>(null);
  readonly stock = signal<InventoryRow[]>([]);
  readonly methods = signal<PaymentMethod[]>([]);
  number!: number;
  allocationId = '';
  returnQuantity = 1;
  stockKey = '';
  newQuantity = 1;
  methodId = '';

  async search() {
    try {
      const [sale, stock, methods] = await Promise.all([
        this.returns.sale(Number(this.number)),
        this.inventory.list(),
        this.data.list<PaymentMethod>('payment_methods', { active: true, pageSize: 50 }),
      ]);
      this.sale.set(sale);
      this.stock.set(stock.filter(item => item.quantity > 0));
      this.methods.set(methods.items);
      const first = this.stock()[0];
      this.stockKey = first ? `${first.variantId}|${first.ownerId}` : '';
      this.methodId = methods.items[0]?.id ?? '';
      this.allocationId = '';
      this.returnQuantity = 1;
    } catch {
      this.toast.show({ title: 'Venta no encontrada', variant: 'danger' });
    }
  }

  available(allocation: any) {
    return Number(allocation.quantity) - (allocation.return_items ?? [])
      .reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
  }

  allocation() {
    for (const item of this.sale()?.sale_items ?? []) {
      for (const allocation of item.sale_item_allocations ?? []) {
        if (allocation.id === this.allocationId) {
          return { ...allocation, unitPrice: Number(item.subtotal) / Number(item.quantity) };
        }
      }
    }
    return null;
  }

  selected() {
    const [variantId, ownerId] = this.stockKey.split('|');
    return this.stock().find(item => item.variantId === variantId && item.ownerId === ownerId);
  }

  difference() {
    const original = this.allocation()?.unitPrice * Number(this.returnQuantity) || 0;
    const replacement = (this.selected()?.price ?? 0) * Number(this.newQuantity);
    return Number((replacement - original).toFixed(2));
  }

  async submit() {
    const original = this.allocation();
    const replacement = this.selected();
    const session = await this.cash.current();
    if (!original || !replacement || !session) {
      this.toast.show({ title: 'Completá la selección y abrí una caja', variant: 'warning' });
      return;
    }
    if (this.returnQuantity < 1 || this.returnQuantity > this.available(original) || this.newQuantity < 1) {
      this.toast.show({ title: 'Revisá las cantidades del cambio', variant: 'warning' });
      return;
    }
    if (this.difference() !== 0 && !this.methodId) {
      this.toast.show({ title: 'Seleccioná el tipo de pago', variant: 'warning' });
      return;
    }
    try {
      await this.service.register({
        originalSaleId: this.sale().id,
        allocationId: original.id,
        returnQuantity: Number(this.returnQuantity),
        cashSessionId: session.id,
        variantId: replacement.variantId,
        ownerId: replacement.ownerId,
        newQuantity: Number(this.newQuantity),
        unitPrice: replacement.price,
        paymentMethodId: this.methodId,
        difference: this.difference(),
      });
      this.toast.show({ title: 'Cambio registrado correctamente', variant: 'success' });
      this.sale.set(null);
    } catch (error) {
      this.toast.show({
        title: 'No se pudo registrar el cambio',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'danger',
      });
    }
  }
}
