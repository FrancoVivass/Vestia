import { Injectable, computed, inject, signal } from '@angular/core';
import { Product, ProductFormValue, ProductVariant } from '../models/product.model';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly client = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);
  private readonly state = signal<Product[]>([]);
  readonly products = computed(() => this.state());

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const { data, error } = await this.client
      .from('products')
      .select('*,product_images(*),product_variants(*,sizes(name),colors(name),inventory_balances(quantity))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw this.asError(error);

    const products = await Promise.all((data ?? []).map(async (item: any): Promise<Product> => {
      const variants = (item.product_variants ?? []).map((variant: any) => this.mapVariant(variant));
      const totalStock = variants.reduce((sum: number, _v: ProductVariant, i: number) => {
        const balances = item.product_variants[i]?.inventory_balances ?? [];
        return sum + balances.reduce((s: number, b: any) => s + Number(b.quantity ?? 0), 0);
      }, 0);
      return {
        id: item.id,
        businessId: item.business_id,
        name: item.name,
        sku: item.sku,
        internalCode: item.internal_code ?? item.sku,
        barcode: item.barcode ?? item.product_variants?.[0]?.barcode ?? '',
        description: item.description ?? '',
        categoryId: item.category_id ?? '',
        brandId: item.brand_id ?? '',
        purchasePrice: Number(item.base_cost ?? 0),
        salePrice: Number(item.base_price),
        promotionalPrice: item.promotional_price === null ? null : Number(item.promotional_price),
        margin: this.calculateMargin(Number(item.base_cost ?? 0), Number(item.base_price)),
        stock: totalStock,
        status: item.active ? 'active' : 'inactive',
        images: await Promise.all((item.product_images ?? []).map(async (image: any) => ({
          id: image.id,
          url: await this.storage.signedUrl('business-assets', image.storage_path),
          path: image.storage_path,
          order: image.sort_order,
        }))),
        variants,
        createdAt: item.created_at,
      };
    }));
    this.state.set(products);
  }

  async create(product: Product): Promise<string> {
    return this.save(null, product);
  }

  async update(id: string, value: ProductFormValue): Promise<string> {
    return this.save(id, value);
  }

  async importMany(products: Product[]): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];
    for (const product of products) {
      try {
        await this.save(null, product, false);
        created += 1;
      } catch (error) {
        errors.push(`${product.name}: ${error instanceof Error ? error.message : 'Error inesperado'}`);
      }
    }
    await this.load();
    return { created, errors };
  }

  async duplicate(id: string): Promise<Product | null> {
    const source = this.state().find((item) => item.id === id);
    if (!source) return null;
    const suffix = Date.now();
    const copy: Product = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (Copia)`,
      sku: `${source.sku}-COPY-${suffix}`,
      variants: source.variants.map((variant) => ({
        ...variant,
        id: crypto.randomUUID(),
        sku: `${variant.sku}-COPY-${suffix}`,
        barcode: `${variant.barcode}${suffix.toString().slice(-5)}`,
      })),
      createdAt: new Date().toISOString(),
    };
    await this.create(copy);
    return copy;
  }

  async toggleStatus(id: string): Promise<void> {
    const product = this.state().find((item) => item.id === id);
    if (!product) throw new Error('Producto inexistente');
    const { error } = await this.client.from('products').update({ active: product.status !== 'active' }).eq('id', id);
    if (error) throw this.asError(error);
    await this.load();
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.rpc('delete_product', { p_product_id: id });
    if (error) throw this.asError(error);
    await this.load();
  }

  getById(id: string): Product | undefined {
    return this.state().find((item) => item.id === id);
  }

  calculateMargin(cost: number, price: number): number {
    return cost ? Number((((price - cost) / cost) * 100).toFixed(2)) : 0;
  }

  private async save(id: string | null, value: ProductFormValue | Product, reload = true): Promise<string> {
    const oldStock = id ? (this.getById(id)?.stock ?? 0) : 0;
    const newStock = Number(value.stock ?? 0);
    const stockDelta = newStock - oldStock;
    const isEdit = !!id;

    const payload = {
      name: value.name,
      sku: value.sku,
      description: value.description,
      category_id: value.categoryId || null,
      brand_id: value.brandId || null,
      base_cost: Number(value.purchasePrice),
      base_price: Number(value.salePrice),
      promotional_price: value.promotionalPrice === null ? null : Number(value.promotionalPrice),
      internal_code: value.internalCode,
      barcode: value.barcode,
      active: value.status === 'active',
      images: value.images.map((image) => ({ path: image.path, order: image.order })),
      variants: value.variants.map((variant) => ({
        id: variant.id,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        barcode: variant.barcode,
        initial_stock: isEdit ? Math.max(0, stockDelta) : Number(variant.stock ?? 0),
        owner_id: variant.ownerId || null,
        cost: Number(variant.cost),
        price: Number(variant.price),
        active: variant.status === 'active',
      })),
    };
    const { data, error } = await this.client.rpc('save_product_complete', { p_product_id: id, p_data: payload });
    if (error) throw this.asError(error);

    if (id && stockDelta < 0) {
      const { data: variants } = await this.client
        .from('product_variants')
        .select('id,inventory_balances(owner_id,quantity)')
        .eq('product_id', id)
        .eq('active', true)
        .limit(1);
      if (variants?.length) {
        const v = variants[0];
        const balances = v.inventory_balances ?? [];
        if (balances.length) {
          const ownerId = balances[0].owner_id;
          const currentQty = Number(balances[0].quantity ?? 0);
          const targetQty = Math.max(0, currentQty + stockDelta);
          await this.client
            .from('inventory_balances')
            .update({ quantity: targetQty, updated_at: new Date().toISOString() })
            .eq('variant_id', v.id)
            .eq('owner_id', ownerId);
        }
      }
    }

    if (reload) await this.load();
    return (data as string) ?? id ?? '';
  }

  private mapVariant(variant: any): ProductVariant {
    return {
      id: variant.id,
      name: `${variant.colors?.name ?? '—'} / ${variant.sizes?.name ?? '—'}`,
      color: variant.colors?.name ?? '',
      size: variant.sizes?.name ?? '',
      sku: variant.sku,
      barcode: variant.barcode,
      stock: 0,
      cost: Number(variant.cost ?? 0),
      price: Number(variant.price),
      status: variant.active ? 'active' : 'inactive',
    };
  }

  private asError(error: any): Error {
    if (error?.code === '23505') {
      const detail = String(error?.details ?? '').toLowerCase();
      if (detail.includes('barcode')) return new Error('Ese código de barras ya está utilizado. Generá otro código para el producto o la variante marcada.');
      if (detail.includes('sku')) return new Error('Ese SKU ya está utilizado. Generá otro SKU para el producto o la variante marcada.');
      return new Error('Hay códigos o una combinación de color y talle repetidos. Revisá los campos marcados.');
    }
    return new Error([error?.message,error?.details,error?.hint,error?.code].filter(Boolean).join(' · ') || 'Error inesperado de Supabase');
  }
}
