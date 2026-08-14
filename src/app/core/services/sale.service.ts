import { Injectable, inject } from '@angular/core';
import { SaleDetail, SaleInput, SaleListRow } from '../models/domain.model';
import { SupabaseService } from './supabase.service';

@Injectable({providedIn:'root'})
export class SaleService {
 private readonly client=inject(SupabaseService).client;
 async complete(input:SaleInput):Promise<string>{ const {data,error}=await this.client.rpc('complete_sale',{p_cash_session:input.cashSessionId,p_customer:input.customerId??null,p_discount:input.discount,p_items:input.items.map(i=>({variant_id:i.variantId,owner_id:i.ownerId,quantity:i.quantity,unit_price:i.unitPrice,discount:i.discount})),p_payments:input.payments.map(p=>({payment_method_id:p.paymentMethodId,amount:p.amount,reference:p.reference??null}))}); if(error) throw error; return data as string; }
 async recent():Promise<SaleListRow[]>{const {data,error}=await this.client.from('sales').select('id,sale_number,subtotal,discount,total,status,created_at,profiles!sales_cashier_id_fkey(first_name,last_name),customers(first_name,last_name)').order('created_at',{ascending:false}).limit(100);if(error)throw error;return (data??[]) as unknown as SaleListRow[];}
 async detail(id:string):Promise<SaleDetail>{const{data,error}=await this.client.from('sales').select('id,sale_number,subtotal,discount,total,status,created_at,profiles!sales_cashier_id_fkey(first_name,last_name),customers(first_name,last_name),sale_items(id,quantity,unit_price,discount,subtotal,product_variants(sku,products(name),sizes(name),colors(name)),sale_item_allocations(id,quantity,unit_cost,owners(first_name,last_name))),sale_payments(id,amount,external_reference,payment_methods(name))').eq('id',id).single();if(error)throw error;return data as unknown as SaleDetail;}
 async cancel(id:string,reason:string):Promise<void>{const{error}=await this.client.rpc('cancel_sale',{p_sale:id,p_reason:reason});if(error)throw error;}
}
