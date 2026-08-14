import { Injectable, inject } from '@angular/core';
import { InventoryRow, PhysicalInventory } from '../models/domain.model';
import { SupabaseService } from './supabase.service';

@Injectable({providedIn:'root'})
export class InventoryService {
 private readonly client=inject(SupabaseService).client;
 async list(search=''):Promise<InventoryRow[]> { let q=this.client.from('inventory_balances').select('variant_id,owner_id,quantity,product_variants!inner(sku,barcode,price,minimum_stock,products!inner(name),sizes(name),colors(name)),owners!inner(first_name,last_name)').order('quantity'); if(search) q=q.or(`sku.ilike.%${search}%,barcode.ilike.%${search}%`,{referencedTable:'product_variants'}); const {data,error}=await q; if(error) throw error; return (data??[]).map((r:any)=>({variantId:r.variant_id,ownerId:r.owner_id,quantity:r.quantity,sku:r.product_variants.sku,barcode:r.product_variants.barcode,price:Number(r.product_variants.price),minimumStock:r.product_variants.minimum_stock,productName:r.product_variants.products.name,size:r.product_variants.sizes?.name??null,color:r.product_variants.colors?.name??null,ownerName:`${r.owners.first_name} ${r.owners.last_name}`})); }
 async currentPhysicalInventory():Promise<PhysicalInventory|null>{const{data,error}=await this.client.from('physical_inventories').select('id,status,notes,started_at,completed_at,created_at,physical_inventory_items(id,variant_id,owner_id,expected_quantity,counted_quantity,product_variants(sku,barcode,products(name),sizes(name),colors(name)),owners(first_name,last_name))').in('status',['DRAFT','IN_PROGRESS']).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data as unknown as PhysicalInventory|null;}
 async startPhysicalInventory(notes=''):Promise<string>{const{data,error}=await this.client.rpc('start_physical_inventory',{p_notes:notes});if(error)throw error;return data as string;}
 async setPhysicalCount(inventoryId:string,variantId:string,ownerId:string,counted:number):Promise<void>{const{error}=await this.client.rpc('set_physical_inventory_count',{p_inventory:inventoryId,p_variant:variantId,p_owner:ownerId,p_counted:counted});if(error)throw error;}
 async completePhysicalInventory(inventoryId:string):Promise<number>{const{data,error}=await this.client.rpc('complete_physical_inventory',{p_inventory:inventoryId});if(error)throw error;return Number(data);}
}
