import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartItem, InventoryRow, SalePaymentInput } from '../../../../core/models/domain.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { CashService } from '../../../../core/services/cash.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { InventorySearchMode, InventoryService } from '../../../../core/services/inventory.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { SaleService } from '../../../../core/services/sale.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ToastService } from '../../../../core/services/toast.service';

type ModalTab = 'search' | 'scanner';

interface PaymentMethod { id: string; name: string; code: string; active: boolean; }
interface Customer { id: string; first_name: string; last_name?: string; }
interface Receipt {
  id: string; saleNumber: number; total: number; createdAt: Date;
  items: CartItem[]; payments: SalePaymentInput[];
  customerName: string; cashierName: string;
  discount: number; discountReason: string;
}

@Component({
  selector: 'app-pos-page',
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './pos-page.html',
  styleUrl: './pos-page.css',
})
export class PosPageComponent implements OnInit, OnDestroy {
  private readonly inventory = inject(InventoryService);
  private readonly sales = inject(SaleService);
  private readonly cash = inject(CashService);
  private readonly data = inject(DataAccessService);
  private readonly client = inject(SupabaseService).client;
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);
  private readonly business = inject(BusinessContextService);
  private readonly el = inject(ElementRef);
  private saleAnim: any;

  readonly stock = signal<InventoryRow[]>([]);
  readonly cart = signal<CartItem[]>([]);
  readonly methods = signal<PaymentMethod[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly payments = signal<SalePaymentInput[]>([]);
  readonly cashSession = signal<any>(null);
  readonly loading = signal(false);
  readonly completedSale = signal<Receipt | null>(null);
  readonly ticketWidth = signal(80);

  // Modal state
  readonly showModal = signal(false);
  readonly modalTab = signal<ModalTab>('search');
  readonly modalSearchFocused = signal(false);

  readonly canAdjustPrices = computed(() => this.permissions.hasRole('OWNER'));
  readonly storeName = computed(() => this.business.activeBusiness()?.name ?? 'VESTIA');
  readonly storeLogo = computed(() => this.business.activeBusiness()?.logoUrl ?? null);
  readonly storeAddress = computed(() => this.business.activeBusiness()?.address ?? '');
  readonly storePhone = computed(() => this.business.activeBusiness()?.phone ?? '');

  search = '';
  searchMode: InventorySearchMode = 'all';
  scannerCode = '';
  customerId = '';
  generalDiscount = 0;
  discountReason = '';
  discountType: 'amount' | 'percentage' = 'amount';
  selectedMethod = '';
  paymentAmount = 0;

  private recalcTrigger = signal(0);

  readonly discountReasons = [
    { value: 'Efectivo', label: 'Pago en efectivo' },
    { value: 'Promoción', label: 'Promoción / oferta' },
    { value: 'Cliente frecuente', label: 'Descuento cliente frecuente' },
    { value: 'Defecto', label: 'Producto con defecto' },
    { value: 'Mayoreo', label: 'Precio de mayoreo' },
    { value: 'Otro', label: 'Otro motivo' },
  ];

  readonly subtotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0)
  );
  readonly total = computed(() => {
    this.recalcTrigger();
    const sub = this.subtotal();
    const disc = Number(this.generalDiscount || 0);
    if (this.discountType === 'percentage') {
      return Math.max(0, sub - sub * (disc / 100));
    }
    return Math.max(0, sub - disc);
  });
  readonly discountAmount = computed(() => {
    this.recalcTrigger();
    const sub = this.subtotal();
    const disc = Number(this.generalDiscount || 0);
    if (this.discountType === 'percentage') {
      return sub * (disc / 100);
    }
    return disc;
  });

  onDiscountChange(value: unknown): void {
    this.generalDiscount = Number(value) || 0;
    this.recalcTrigger.update(v => v + 1);
  }
  readonly paid = computed(() => this.payments().reduce((sum, p) => sum + p.amount, 0));
  readonly pending = computed(() => Number((this.total() - this.paid()).toFixed(2)));
  readonly cartCount = computed(() => this.cart().reduce((sum, item) => sum + item.quantity, 0));

  async ngOnInit(): Promise<void> {
    await Promise.all([this.refresh(), this.loadTicketSettings()]);
  }

  ngOnDestroy(): void {
    this.saleAnim?.destroy();
  }

  private async loadTicketSettings(): Promise<void> {
    const { data } = await this.client.from('app_settings').select('ticket_settings').maybeSingle();
    const settings = data?.ticket_settings as { width?: number } | null;
    if (settings?.width === 58 || settings?.width === 80) this.ticketWidth.set(settings.width);
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [stock, methods, session, customers] = await Promise.all([
        this.inventory.list(this.search, this.searchMode),
        this.data.list<PaymentMethod>('payment_methods', { pageSize: 50, active: true }),
        this.cash.current(),
        this.data.list<Customer>('customers', { pageSize: 200, active: true }),
      ]);
      this.stock.set(stock);
      this.methods.set(methods.items.filter(m => m.code !== 'EXCHANGE_CREDIT'));
      this.customers.set(customers.items);
      this.cashSession.set(session);
      if (!this.selectedMethod && this.methods().length) this.selectedMethod = this.methods()[0].id;
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }

  openModal(): void {
    this.showModal.set(true);
    this.modalTab.set('search');
    this.search = '';
    this.searchMode = 'all';
    this.scannerCode = '';
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('#modal-search-input')?.focus();
    }, 100);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  switchTab(tab: ModalTab): void {
    this.modalTab.set(tab);
    if (tab === 'scanner') {
      setTimeout(() => document.querySelector<HTMLInputElement>('#modal-scanner-input')?.focus(), 100);
    } else {
      setTimeout(() => document.querySelector<HTMLInputElement>('#modal-search-input')?.focus(), 100);
    }
  }

  async modalSearch(): Promise<void> {
    this.loading.set(true);
    try {
      this.stock.set(await this.inventory.list(this.search, this.searchMode));
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }

  async modalScan(): Promise<void> {
    const code = this.scannerCode.trim();
    if (!code) return;
    this.loading.set(true);
    try {
      const matches = (await this.inventory.list(code, 'barcode')).filter(
        row => row.barcode.toLowerCase() === code.toLowerCase() || row.productBarcode.toLowerCase() === code.toLowerCase()
      );
      const available = matches.find(row => {
        const current = this.cart().find(item => item.variantId === row.variantId && item.ownerId === row.ownerId);
        return row.quantity > 0 && (!current || current.quantity < current.available);
      });
      if (!available) {
        this.toast.show({
          title: matches.length ? 'Stock insuficiente' : 'Código no encontrado',
          description: matches.length
            ? `No queda stock disponible para este código.`
            : `No existe un producto con el código ${code}.`,
          variant: 'warning',
        });
        return;
      }
      this.add(available);
      this.toast.show({ title: 'Producto escaneado', description: `${available.productName} · ${available.sku}`, variant: 'success' });
      this.scannerCode = '';
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
      setTimeout(() => document.querySelector<HTMLInputElement>('#modal-scanner-input')?.focus());
    }
  }

  add(row: InventoryRow): void {
    if (row.quantity <= 0) return;
    const current = this.cart().find(item => item.variantId === row.variantId && item.ownerId === row.ownerId);
    if (current) {
      if (current.quantity >= current.available) {
        this.toast.show({ title: 'Stock insuficiente', description: `Disponible: ${current.available}`, variant: 'warning' });
        return;
      }
      this.cart.update(items =>
        items.map(item => item === current ? { ...item, quantity: item.quantity + 1 } : item)
      );
    } else {
      this.cart.update(items => [
        ...items,
        {
          variantId: row.variantId,
          ownerId: row.ownerId,
          productName: row.productName,
          variantName: `${row.color ?? '—'} / ${row.size ?? '—'}`,
          sku: row.sku,
          quantity: 1,
          available: row.quantity,
          unitPrice: row.price,
          discount: 0,
        },
      ]);
    }
    this.toast.show({ title: 'Agregado al carrito', description: row.productName, variant: 'success' });
  }

  quantity(item: CartItem, delta: number): void {
    this.cart.update(items =>
      items.map(c =>
        c === item ? { ...c, quantity: Math.max(1, Math.min(c.available, c.quantity + delta)) } : c
      )
    );
  }

  price(item: CartItem, value: unknown): void {
    if (!this.canAdjustPrices()) return;
    this.cart.update(items =>
      items.map(c => (c === item ? { ...c, unitPrice: Number(value) || 0 } : c))
    );
  }

  remove(item: CartItem): void {
    this.cart.update(items => items.filter(c => c !== item));
  }

  addPayment(): void {
    const amount = Number(this.paymentAmount || this.pending());
    if (!this.selectedMethod || amount <= 0 || amount > this.pending()) {
      this.toast.show({ title: 'Importe de pago inválido', variant: 'warning' });
      return;
    }
    this.payments.update(payments => [...payments, { paymentMethodId: this.selectedMethod, amount }]);
    this.paymentAmount = 0;
  }

  removePayment(index: number): void {
    this.payments.update(payments => payments.filter((_, i) => i !== index));
  }

  methodName(id: string): string {
    return this.methods().find(m => m.id === id)?.name ?? 'Pago';
  }

  async charge(): Promise<void> {
    if (!this.cashSession()) {
      this.toast.show({ title: 'Abrí una caja antes de cobrar', variant: 'warning' });
      return;
    }
    if (!this.cart().length || this.cart().some(item => item.unitPrice <= 0)) {
      this.toast.show({ title: 'Carrito incompleto', variant: 'warning' });
      return;
    }
    if (!this.payments().length && this.selectedMethod)
      this.payments.set([{ paymentMethodId: this.selectedMethod, amount: this.total() }]);
    if (Math.abs(this.pending()) > 0.001) {
      this.toast.show({ title: 'La suma de pagos debe coincidir con el total', description: `Pendiente: $ ${this.pending()}`, variant: 'warning' });
      return;
    }
    this.loading.set(true);
    try {
      const receiptItems = this.cart().map(item => ({ ...item }));
      const receiptPayments = this.payments().map(p => ({ ...p }));
      const receiptTotal = this.total();
      const id = await this.sales.complete({
        cashSessionId: this.cashSession().id,
        customerId: this.customerId || null,
        discount: this.discountAmount(),
        items: this.cart(),
        payments: this.payments(),
      });
      const detail = await this.sales.detail(id);
      const customer = this.customers().find(c => c.id === this.customerId);
      this.completedSale.set({
        id,
        saleNumber: detail.sale_number,
        total: receiptTotal,
        createdAt: new Date(detail.created_at),
        items: receiptItems,
        payments: receiptPayments,
        customerName: customer ? `${customer.first_name} ${customer.last_name ?? ''}`.trim() : 'Consumidor final',
        cashierName: `${detail.profiles.first_name} ${detail.profiles.last_name}`.trim(),
        discount: this.discountAmount(),
        discountReason: this.generalDiscount > 0 ? (this.discountReason || 'Otro') : '',
      });
      this.cart.set([]);
      this.showModal.set(false);
      this.toast.show({ title: 'Venta realizada correctamente', variant: 'success' });
      await this.refresh();
      setTimeout(() => this.loadSaleAnim(), 100);
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }

  newSale(): void {
    this.completedSale.set(null);
    this.generalDiscount = 0;
    this.discountReason = '';
    this.discountType = 'amount';
    this.paymentAmount = 0;
    this.payments.set([]);
    this.customerId = '';
    this.saleAnim?.destroy();
    this.saleAnim = null;
  }

  async loadSaleAnim(): Promise<void> {
    const lottie = await import('lottie-web');
    this.saleAnim?.destroy();
    this.saleAnim = lottie.default.loadAnimation({
      container: this.el.nativeElement.querySelector('#sale-lottie'),
      renderer: 'svg',
      loop: false,
      autoplay: true,
      path: 'assets/finalizarcompra.json',
    });
  }

  print(): void {
    window.print();
  }

  @HostListener('window:keydown', ['$event'])
  shortcuts(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.showModal()) { this.closeModal(); return; }
    if (event.key === 'F2') { event.preventDefault(); this.newSale(); }
    if (event.key === 'F8' && !this.showModal()) { event.preventDefault(); void this.charge(); }
    if ((event.key === 'F4' || (event.ctrlKey && event.key.toLowerCase() === 'k')) && this.showModal()) {
      event.preventDefault();
      this.switchTab('search');
    }
    if (event.key === 'F6' && this.showModal()) {
      event.preventDefault();
      this.switchTab('scanner');
    }
  }

  private fail(error: unknown): void {
    this.toast.show({
      title: 'No se pudo completar la operación',
      description: error instanceof Error ? error.message : 'Verificá Supabase.',
      variant: 'danger',
    });
  }
}
