create or replace function public.delete_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'No tenés permisos para eliminar comercios';
  end if;

  if not exists (select 1 from businesses where id = p_business_id) then
    raise exception 'Comercio no encontrado';
  end if;

  -- Eliminar en orden correcto por dependencias de foreign keys
  -- Round 1: tablas sin dependencias internas
  delete from notifications where business_id = p_business_id;
  delete from cash_close_reports where business_id = p_business_id;
  delete from profile_permissions where profile_id in (
    select id from profiles where business_id = p_business_id
  );
  delete from owner_settlements where business_id = p_business_id;
  delete from stock_movements where business_id = p_business_id;
  delete from expenses where business_id = p_business_id;
  delete from physical_inventory_items where inventory_id in (
    select id from physical_inventories where business_id = p_business_id
  );
  delete from return_items where return_id in (
    select id from returns where business_id = p_business_id
  );
  delete from app_settings where business_id = p_business_id;
  delete from inventory_balances where business_id = p_business_id;
  delete from product_labels where variant_id in (
    select pv.id from product_variants pv join products p on p.id = pv.product_id where p.business_id = p_business_id
  );
  delete from product_images where product_id in (
    select id from products where business_id = p_business_id
  );
  delete from sale_payments where sale_id in (
    select id from sales where business_id = p_business_id
  );
  delete from exchanges where business_id = p_business_id;
  delete from cash_movements where business_id = p_business_id;

  -- Round 2: después de return_items, exchanges
  delete from returns where business_id = p_business_id;
  delete from sale_item_allocations where sale_item_id in (
    select si.id from sale_items si join sales s on s.id = si.sale_id where s.business_id = p_business_id
  );
  delete from physical_inventories where business_id = p_business_id;

  -- Round 3: después de sale_item_allocations, stock_movements
  delete from sale_items where sale_id in (
    select id from sales where business_id = p_business_id
  );
  delete from inventory_lots where business_id = p_business_id;
  delete from payment_methods where business_id = p_business_id;

  -- Round 4: después de sale_items, inventory_lots, payment_methods
  delete from sales where business_id = p_business_id;
  delete from purchase_items where purchase_id in (
    select id from purchases where business_id = p_business_id
  );

  -- Round 5: después de sales, purchase_items, cash_close_reports
  delete from cash_sessions where business_id = p_business_id;
  delete from customers where business_id = p_business_id;
  delete from product_variants where product_id in (
    select id from products where business_id = p_business_id
  );
  delete from purchases where business_id = p_business_id;

  -- Round 6: después de cash_sessions, product_variants, purchases
  delete from cash_registers where business_id = p_business_id;
  delete from products where business_id = p_business_id;
  delete from sizes where business_id = p_business_id;
  delete from colors where business_id = p_business_id;
  delete from profiles where business_id = p_business_id;

  -- Round 7: después de products, profiles
  delete from categories where business_id = p_business_id;
  delete from brands where business_id = p_business_id;
  delete from suppliers where business_id = p_business_id;
  delete from owners where business_id = p_business_id;

  -- Round 8: todo limpio, audit_logs al final por triggers
  delete from audit_logs where business_id = p_business_id;
  delete from businesses where id = p_business_id;
end;
$$;
