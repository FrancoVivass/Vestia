import { AfterViewChecked, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import JsBarcode from 'jsbarcode';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ToastService } from '../../../../core/services/toast.service';

interface LabelOwner {
  owner_id: string;
  quantity: number;
  owners: { id: string; first_name: string; last_name: string };
}

interface LabelVariant {
  id: string;
  sku: string;
  barcode: string;
  price: number;
  products: { name: string };
  sizes: { name: string } | null;
  colors: { name: string } | null;
  inventory_balances: LabelOwner[];
}

@Component({
  selector: 'app-labels-page',
  imports: [FormsModule],
  templateUrl: './labels-page.html',
  styleUrl: './labels-page.css',
})
export class LabelsPageComponent implements OnInit, AfterViewChecked {
  private readonly client = inject(SupabaseService).client;
  private readonly toast = inject(ToastService);
  readonly variants = signal<LabelVariant[]>([]);
  readonly settings = signal({ width: 50, height: 30, columns: 3 });
  readonly showPrice = signal(true);
  variantId = '';
  ownerId = '';
  quantity = 1;

  async ngOnInit() {
    try {
      const [variants, appSettings] = await Promise.all([
        this.client.from('product_variants')
          .select('id,sku,barcode,price,products(name),sizes(name),colors(name),inventory_balances(owner_id,quantity,owners(id,first_name,last_name))')
          .eq('active', true)
          .order('sku'),
        this.client.from('app_settings').select('label_settings').maybeSingle(),
      ]);
      if (variants.error) throw variants.error;
      if (appSettings.error) throw appSettings.error;
      this.variants.set((variants.data ?? []) as unknown as LabelVariant[]);
      const configured = appSettings.data?.label_settings as Partial<{width:number;height:number;columns:number}> | null;
      if (configured) this.settings.update(current => ({ ...current, ...configured }));
      const first = this.variants()[0];
      if (first) {
        this.variantId = first.id;
        this.selectFirstOwner();
      }
    } catch (error) {
      this.toast.show({
        title: 'No se pudieron cargar las etiquetas',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'danger',
      });
    }
  }

  get selected() { return this.variants().find(variant => variant.id === this.variantId); }
  get owners() { return (this.selected?.inventory_balances ?? []).filter(owner => owner.quantity > 0); }
  get selectedOwner() { return this.owners.find(owner => owner.owner_id === this.ownerId); }

  selectFirstOwner() {
    this.ownerId = this.owners[0]?.owner_id ?? '';
    this.redraw();
  }

  ngAfterViewChecked() {
    document.querySelectorAll<SVGElement>('svg[data-barcode]:not([data-ready])').forEach(svg => {
      JsBarcode(svg, svg.dataset['barcode'] ?? '', {
        format: 'CODE128',
        displayValue: true,
        height: 30,
        margin: 1,
        fontSize: 9,
      });
      svg.dataset['ready'] = '1';
    });
  }

  redraw() {
    setTimeout(() => document.querySelectorAll('svg[data-ready]').forEach(element => element.removeAttribute('data-ready')));
  }

  print() { window.print(); }
}
