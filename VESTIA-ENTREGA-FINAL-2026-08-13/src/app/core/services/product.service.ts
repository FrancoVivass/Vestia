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
      .select('*,product_images(*),product_variants(*,sizes(name),colors(name))')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const products = await Promise.all((data ?? []).map(async (item: any): Promise<Product> => ({
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
      minStock: item.minimum_stock,
      maxStock: Number(item.maximum_stock ?? 0),
      status: item.active ? 'active' : 'inactive',
      images: await Promise.all((item.product_images ?? []).map(async (image: any) => ({
        id: image.id,
        url: await this.storage.signedUrl('business-assets', image.storage_path),
        path: image.storage_path,
        order: image.sort_order,
      }))),
      variants: (item.product_variants ?? []).map((variant: any) => this.mapVariant(variant)),
      createdAt: item.created_at,
    })));
    this.state.set(products);
  }

  async create(product: Product): Promise<void> {
    await this.save(null, product);
  }

  async update(id: string, value: ProductFormValue): Promise<void> {
    await this.save(id, value);
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
    if (error) throw error;
    await this.load();
  }

  getById(id: string): Product | undefined {
    return this.state().find((item) => item.id === id);
  }

  calculateMargin(cost: number, price: number): number {
    return cost ? Number((((price - cost) / cost) * 100).toFixed(2)) : 0;
  }

  private async save(id: string | null, value: ProductFormValue | Product): Promise<void> {
    const payload = {
      name: value.name,
      sku: value.sku,
      description: value.description,
      category_id: value.categoryId || null,
      brand_id: value.brandId || null,
      base_cost: Number(value.purchasePrice),
      base_price: Number(value.salePrice),
      promotional_price: value.promotionalPrice === null ? null : Number(value.promotionalPrice),
      minimum_stock: Number(value.minStock),
      maximum_stock: Number(value.maxStock),
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
        cost: Number(variant.cost),
        price: Number(variant.price),
        active: variant.status === 'active',
      })),
    };
    const { error } = await this.client.rpc('save_product_complete', { p_product_id: id, p_data: payload });
    if (error) throw error;
    await this.load();
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
}
