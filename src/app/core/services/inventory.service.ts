import { Injectable, inject } from '@angular/core';
import { InventoryRow, PhysicalInventory } from '../models/domain.model';
import { SupabaseService } from './supabase.service';

export type InventorySearchMode = 'all' | 'name' | 'sku' | 'internal' | 'barcode';

const normalizeInventorySearch = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function filterInventoryRows(rows: InventoryRow[], search = '', mode: InventorySearchMode = 'all'): InventoryRow[] {
  const terms = normalizeInventorySearch(search).split(/\s+/).filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter(row => {
    const values: Record<InventorySearchMode, string[]> = {
      all: [row.productName,row.sku,row.internalCode,row.barcode,row.productBarcode,row.color ?? '',row.size ?? '',row.ownerName],
      name: [row.productName],
      sku: [row.sku],
      internal: [row.internalCode],
      barcode: [row.barcode,row.productBarcode],
    };
    const haystack = normalizeInventorySearch(values[mode].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly client = inject(SupabaseService).client;

  async list(search = '', mode: InventorySearchMode = 'all'): Promise<InventoryRow[]> {
    const { data, error } = await this.client
      .from('product_variants')
      .select('id,sku,barcode,price,minimum_stock,active,products!inner(name,internal_code,barcode,active,deleted_at),sizes(name),colors(name),inventory_balances(owner_id,quantity,owners(first_name,last_name))')
      .order('created_at', { ascending: false });
    if (error) throw this.asError(error);

    const rows = (data ?? [])
      .filter((variant: any) => variant.active && variant.products?.active && !variant.products?.deleted_at)
      .flatMap((variant: any): InventoryRow[] => {
        const balances = variant.inventory_balances?.length
          ? variant.inventory_balances
          : [{ owner_id: '', quantity: 0, owners: null }];
        return balances.map((balance: any): InventoryRow => ({
          variantId: variant.id,
          ownerId: balance.owner_id ?? '',
          quantity: Number(balance.quantity ?? 0),
          sku: variant.sku,
          barcode: variant.barcode,
          price: Number(variant.price),
          minimumStock: Number(variant.minimum_stock),
          productName: variant.products.name,
          internalCode: variant.products.internal_code ?? '',
          productBarcode: variant.products.barcode ?? '',
          size: variant.sizes?.name ?? null,
          color: variant.colors?.name ?? null,
          ownerName: balance.owners ? `${balance.owners.first_name} ${balance.owners.last_name}` : 'Sin stock asignado',
        }));
      });

    return filterInventoryRows(rows, search, mode);
  }

  async currentPhysicalInventory(): Promise<PhysicalInventory | null> {
    const { data, error } = await this.client.from('physical_inventories').select('id,status,notes,started_at,completed_at,created_at,physical_inventory_items(id,variant_id,owner_id,expected_quantity,counted_quantity,product_variants(sku,barcode,products(name),sizes(name),colors(name)),owners(first_name,last_name))').in('status',['DRAFT','IN_PROGRESS']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (error) throw this.asError(error);
    return data as unknown as PhysicalInventory | null;
  }

  async startPhysicalInventory(notes = ''): Promise<string> {
    const { data, error } = await this.client.rpc('start_physical_inventory',{p_notes:notes});
    if (error) throw this.asError(error);
    return data as string;
  }

  async setPhysicalCount(inventoryId:string,variantId:string,ownerId:string,counted:number): Promise<void> {
    const { error } = await this.client.rpc('set_physical_inventory_count',{p_inventory:inventoryId,p_variant:variantId,p_owner:ownerId,p_counted:counted});
    if (error) throw this.asError(error);
  }

  async completePhysicalInventory(inventoryId:string): Promise<number> {
    const { data, error } = await this.client.rpc('complete_physical_inventory',{p_inventory:inventoryId});
    if (error) throw this.asError(error);
    return Number(data);
  }

  private asError(error: any): Error {
    return new Error([error?.message,error?.details,error?.hint,error?.code].filter(Boolean).join(' · ') || 'Error inesperado de Supabase');
  }
}
