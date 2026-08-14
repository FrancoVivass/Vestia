import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { readSheet } from 'read-excel-file/browser';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

export interface ProductImportVariantDraft {
  id: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  cost: number;
  price: number;
  stock: number;
  ownerName: string;
  status: 'active' | 'inactive';
}

export interface ProductImportDraft {
  group: string;
  name: string;
  description: string;
  categoryName: string;
  brandName: string;
  purchasePrice: number;
  salePrice: number;
  promotionalPrice: number | null;
  minStock: number;
  maxStock: number;
  sku: string;
  internalCode: string;
  barcode: string;
  status: 'active' | 'inactive';
  variants: ProductImportVariantDraft[];
}

@Component({
  selector: 'app-product-import-modal',
  imports: [ModalComponent],
  templateUrl: './product-import-modal.html',
  styleUrl: './product-import-modal.css',
})
export class ProductImportModalComponent implements OnChanges {
  @Input() open = false;
  @Input() loading = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly imported = new EventEmitter<ProductImportDraft[]>();

  readonly parsing = signal(false);
  readonly filename = signal('');
  readonly drafts = signal<ProductImportDraft[]>([]);
  readonly errors = signal<string[]>([]);
  readonly rowCount = signal(0);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) this.reset();
  }

  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.drafts.set([]);
    this.errors.set([]);
    this.rowCount.set(0);
    if (!file) return;
    this.filename.set(file.name);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.errors.set(['El archivo debe tener formato .xlsx.']);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errors.set(['El archivo supera el máximo permitido de 10 MB.']);
      return;
    }

    this.parsing.set(true);
    try {
      const rows = await readSheet(file, 'Productos');
      this.parseRows(rows as unknown[][]);
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'No se pudo leer la hoja “Productos”.']);
    } finally {
      this.parsing.set(false);
      input.value = '';
    }
  }

  confirm(): void {
    if (this.errors().length || !this.drafts().length) return;
    this.imported.emit(this.drafts());
  }

  reset(): void {
    this.filename.set('');
    this.drafts.set([]);
    this.errors.set([]);
    this.rowCount.set(0);
  }

  private parseRows(rows: unknown[][]): void {
    const expected = [
      'Grupo producto *','Nombre producto *','Descripción','Categoría (opcional)','Marca (opcional)',
      'Precio compra','Precio venta *','Precio promocional','Stock mínimo','Stock máximo','Stock inicial','Dueño mercadería (opcional)','Color','Talle',
      'SKU producto (auto)','Código interno (auto)','Código barras producto (auto)','SKU variante (auto)','Código barras variante (auto)','Estado',
    ];
    const header = (rows[0] ?? []).slice(0,expected.length).map(value => String(value ?? '').trim());
    if (expected.some((value,index) => header[index] !== value)) {
      this.errors.set(['La cabecera no coincide con la plantilla VESTIA. Descargá una plantilla nueva y no cambies los nombres de las columnas.']);
      return;
    }

    const dataRows = rows.slice(1).map((values,index) => ({ values, row: index + 2 }))
      .filter(({ values }) => String(values[0] ?? '').trim() || String(values[1] ?? '').trim());
    this.rowCount.set(dataRows.length);
    const errors: string[] = [];
    const groups = new Map<string, Array<{ values: unknown[]; row: number }>>();
    for (const entry of dataRows) {
      const group = String(entry.values[0] ?? '').trim();
      const name = String(entry.values[1] ?? '').trim();
      const salePrice = this.number(entry.values[6]);
      if (!group) errors.push(`Fila ${entry.row}: falta Grupo producto.`);
      if (!name) errors.push(`Fila ${entry.row}: falta Nombre producto.`);
      if (salePrice === null || salePrice < 0) errors.push(`Fila ${entry.row}: Precio venta debe ser un número igual o mayor a cero.`);
      for (const [column,label] of [[5,'Precio compra'],[7,'Precio promocional'],[8,'Stock mínimo'],[9,'Stock máximo'],[10,'Stock inicial']] as const) {
        const value = this.number(entry.values[column], true);
        if (value !== null && value < 0) errors.push(`Fila ${entry.row}: ${label} no puede ser negativo.`);
      }
      if (group) groups.set(group.toLowerCase(),[...(groups.get(group.toLowerCase()) ?? []),entry]);
    }
    if (!dataRows.length) errors.push('La hoja “Productos” no contiene filas para importar.');
    if (errors.length) {
      this.errors.set(errors.slice(0,50));
      return;
    }

    const usedCodes = new Set<string>();
    let barcodeCounter = 0;
    const batchSeed = Date.now().toString().slice(-9);
    const numericBarcode = () => {
      let value = `2${batchSeed}${String(barcodeCounter++).padStart(3,'0')}`;
      while (usedCodes.has(value)) value = `2${batchSeed}${String(barcodeCounter++).padStart(3,'0')}`;
      usedCodes.add(value);
      return value;
    };
    const drafts: ProductImportDraft[] = [];
    for (const entries of groups.values()) {
      const first = entries[0].values;
      const group = String(first[0]).trim();
      const name = String(first[1]).trim();
      const base = this.slug(group || name);
      const unique = `${Date.now().toString(36).slice(-5)}${crypto.randomUUID().replace(/-/g,'').slice(0,3)}`.toUpperCase();
      const productSku = this.text(first[14]) || `${base}-${unique}`;
      const internalCode = this.text(first[15]) || `INT-${base}-${unique}`;
      const productBarcode = this.text(first[16]) || numericBarcode();
      [productSku,internalCode,productBarcode].forEach(code => usedCodes.add(code.toLowerCase()));
      const purchasePrice = this.number(first[5],true) ?? 0;
      const salePrice = this.number(first[6]) ?? 0;
      const minStock = Math.trunc(this.number(first[8],true) ?? 0);
      const maxStock = Math.trunc(this.number(first[9],true) ?? 0);
      if (maxStock > 0 && maxStock < minStock) {
        errors.push(`Grupo ${group}: Stock máximo debe ser 0 o mayor o igual al mínimo.`);
        continue;
      }
      const variants = entries.map((entry,index): ProductImportVariantDraft => ({
        id: crypto.randomUUID(),
        color: this.text(entry.values[12]) || 'Sin color',
        size: this.text(entry.values[13]) || 'Único',
        sku: this.text(entry.values[17]) || `${productSku}-V${String(index + 1).padStart(2,'0')}`,
        barcode: this.text(entry.values[18]) || numericBarcode(),
        cost: this.number(entry.values[5],true) ?? purchasePrice,
        price: this.number(entry.values[6]) ?? salePrice,
        stock: Math.trunc(this.number(entry.values[10],true) ?? 0),
        ownerName: this.text(entry.values[11]),
        status: this.status(entry.values[19]),
      }));
      const variantSkus = variants.map(variant => variant.sku.trim().toLowerCase());
      const variantBarcodes = variants.map(variant => variant.barcode.trim().toLowerCase());
      const combinations = variants.map(variant => `${variant.color.trim().toLowerCase()}|${variant.size.trim().toLowerCase()}`);
      if (new Set(variantSkus).size !== variants.length) errors.push(`Grupo ${group}: hay SKU de variantes repetidos.`);
      if (new Set(variantBarcodes).size !== variants.length) errors.push(`Grupo ${group}: hay códigos de barras de variantes repetidos.`);
      if (new Set(combinations).size !== variants.length) errors.push(`Grupo ${group}: hay combinaciones de color y talle repetidas.`);
      drafts.push({
        group,name,
        description:this.text(first[2]),categoryName:this.text(first[3]),brandName:this.text(first[4]),
        purchasePrice,salePrice,promotionalPrice:this.number(first[7],true),minStock,maxStock,
        sku:productSku,internalCode,barcode:productBarcode,status:this.status(first[19]),variants,
      });
    }
    this.errors.set(errors.slice(0,50));
    this.drafts.set(errors.length ? [] : drafts);
  }

  private text(value: unknown): string { return String(value ?? '').trim(); }
  private status(value: unknown): 'active' | 'inactive' { return this.text(value).toUpperCase() === 'INACTIVO' ? 'inactive' : 'active'; }
  private slug(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,18) || 'PRODUCTO'; }
  private number(value: unknown, optional = false): number | null {
    if (value === null || value === undefined || value === '') return optional ? null : null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let text = String(value).trim().replace(/\s/g,'');
    if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g,'').replace(',','.') : text.replace(/,/g,'');
    else if (text.includes(',')) text = text.replace(',','.');
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
