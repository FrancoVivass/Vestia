export type UserRole = 'OWNER' | 'CASHIER';
export type EntityStatus = 'ACTIVE' | 'INACTIVE';

export interface Owner { id:string; businessId:string; firstName:string; lastName:string; document:string|null; phone:string|null; email:string|null; participationPercentage:number|null; active:boolean; }
export interface CatalogOption { id:string; name:string; active:boolean; }
export interface VariantStock { ownerId:string; ownerName:string; quantity:number; }
export interface ProductVariantRecord { id:string; productId:string; sku:string; barcode:string; sizeName:string|null; colorName:string|null; cost:number|null; price:number; minimumStock:number; active:boolean; stocks:VariantStock[]; }
export interface InventoryRow { variantId:string; productName:string; sku:string; barcode:string; size:string|null; color:string|null; ownerId:string; ownerName:string; quantity:number; minimumStock:number; price:number; }
export interface CartItem { variantId:string; ownerId:string; productName:string; variantName:string; sku:string; quantity:number; available:number; unitPrice:number; discount:number; }
export interface SalePaymentInput { paymentMethodId:string; amount:number; reference?:string; }
export interface SaleInput { cashSessionId:string; customerId?:string|null; discount:number; items:CartItem[]; payments:SalePaymentInput[]; }

export interface PaymentMethodRecord { id:string; code:string; name:string; requires_reference:boolean; active:boolean; }
export interface CashRegisterRecord { id:string; name:string; active:boolean; }
export interface ExpenseRecord {
  id:string; category:string; concept:string; amount:number; occurred_at:string; notes:string|null;
  owners:{first_name:string;last_name:string}|null;
  payment_methods:{name:string}|null;
}
export interface PhysicalInventoryItem {
  id:string; variant_id:string; owner_id:string; expected_quantity:number; counted_quantity:number|null;
  product_variants:{sku:string;barcode:string;products:{name:string};sizes:{name:string}|null;colors:{name:string}|null};
  owners:{first_name:string;last_name:string};
}
export interface PhysicalInventory {
  id:string; status:'DRAFT'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'; notes:string|null;
  started_at:string|null; completed_at:string|null; created_at:string;
  physical_inventory_items:PhysicalInventoryItem[];
}
export interface SaleListRow {
  id:string; sale_number:number; subtotal:number; discount:number; total:number;
  status:'COMPLETED'|'CANCELLED'|'RETURNED'|'PARTIALLY_RETURNED'; created_at:string;
  profiles:{first_name:string;last_name:string}; customers:{first_name:string;last_name:string|null}|null;
}
export interface SaleDetail extends SaleListRow {
  sale_items:Array<{id:string;quantity:number;unit_price:number;discount:number;subtotal:number;
    product_variants:{sku:string;products:{name:string};sizes:{name:string}|null;colors:{name:string}|null};
    sale_item_allocations:Array<{id:string;quantity:number;unit_cost:number;owners:{first_name:string;last_name:string}}>}>;
  sale_payments:Array<{id:string;amount:number;external_reference:string|null;payment_methods:{name:string}}>;
}
export interface OwnerSettlement {
  id:string; gross:number; cost:number; expenses:number; returns:number; profit:number; units:number; stock:number;
}
