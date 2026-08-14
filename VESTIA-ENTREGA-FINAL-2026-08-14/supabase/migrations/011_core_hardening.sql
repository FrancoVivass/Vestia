begin;

insert into public.permissions(code, name, module) values
  ('products.read', 'Ver productos', 'Productos'),
  ('products.create', 'Crear productos', 'Productos'),
  ('products.update', 'Editar productos', 'Productos'),
  ('products.delete', 'Desactivar productos', 'Productos'),
  ('stock.read', 'Consultar stock', 'Inventario'),
  ('stock.adjust', 'Ajustar stock', 'Inventario'),
  ('sales.read', 'Consultar ventas', 'Ventas'),
  ('sales.create', 'Realizar ventas', 'Ventas'),
  ('sales.cancel', 'Anular ventas', 'Ventas'),
  ('customers.read', 'Consultar clientes', 'Clientes'),
  ('customers.create', 'Registrar clientes', 'Clientes'),
  ('customers.update', 'Editar clientes', 'Clientes'),
  ('suppliers.read', 'Consultar proveedores', 'Proveedores'),
  ('suppliers.create', 'Registrar proveedores', 'Proveedores'),
  ('purchases.read', 'Consultar compras', 'Compras'),
  ('purchases.create', 'Registrar compras', 'Compras'),
  ('cash.read', 'Consultar caja', 'Caja'),
  ('cash.open', 'Abrir caja', 'Caja'),
  ('cash.close', 'Cerrar caja', 'Caja'),
  ('cash.movements', 'Registrar movimientos de caja', 'Caja'),
  ('reports.read', 'Consultar reportes', 'Reportes'),
  ('users.read', 'Consultar usuarios', 'Usuarios'),
  ('users.create', 'Crear usuarios', 'Usuarios'),
  ('users.update', 'Editar usuarios', 'Usuarios'),
  ('users.delete', 'Activar o desactivar usuarios', 'Usuarios'),
  ('settings.read', 'Consultar configuración', 'Configuración'),
  ('settings.update', 'Editar configuración', 'Configuración'),
  ('returns.create', 'Gestionar devoluciones', 'Posventa'),
  ('exchanges.create', 'Gestionar cambios', 'Posventa')
on conflict(code) do update set name = excluded.name, module = excluded.module;

insert into public.role_permissions(role, permission_code, enabled)
select 'OWNER', code, true from public.permissions
on conflict(role, permission_code) do update set enabled = true;

insert into public.role_permissions(role, permission_code, enabled) values
  ('CASHIER', 'products.read', true),
  ('CASHIER', 'stock.read', true),
  ('CASHIER', 'sales.read', true),
  ('CASHIER', 'sales.create', true),
  ('CASHIER', 'customers.read', true),
  ('CASHIER', 'customers.create', true),
  ('CASHIER', 'cash.read', true),
  ('CASHIER', 'cash.open', true),
  ('CASHIER', 'cash.close', true)
on conflict(role, permission_code) do update set enabled = excluded.enabled;

create or replace function public.open_cash_register(p_register_id uuid, p_opening numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_business uuid := public.current_business_id();
  v_id uuid;
begin
  if v_profile is null or v_business is null then raise exception 'No existe un comercio activo'; end if;
  if p_opening is null or p_opening < 0 then raise exception 'Monto de apertura inválido'; end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('cash.open') then raise exception 'Permiso denegado'; end if;

  insert into public.cash_sessions(business_id, cash_register_id, opened_by, opening_amount)
  select v_business, register.id, v_profile, p_opening
  from public.cash_registers register
  where register.id = p_register_id and register.business_id = v_business and register.active
  returning id into v_id;
  if v_id is null then raise exception 'Caja inexistente o inactiva'; end if;

  if p_opening > 0 then
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, description, performed_by)
    values(v_business, v_id, 'OPENING', p_opening, 'Apertura de caja', v_profile);
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'La caja ya se encuentra abierta';
end;
$$;

create or replace function public.close_cash_register(p_session uuid, p_counted numeric, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected numeric(14,2);
  v_profile uuid := public.current_profile_id();
begin
  if p_counted is null or p_counted < 0 then raise exception 'Monto contado inválido'; end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('cash.close') then raise exception 'Permiso denegado'; end if;

  select session.opening_amount + coalesce((
    select sum(case when movement.movement_type = 'OPENING' then 0 else movement.amount end)
    from public.cash_movements movement where movement.cash_session_id = session.id
  ), 0)
  into v_expected
  from public.cash_sessions session
  where session.id = p_session
    and session.business_id = public.current_business_id()
    and session.status = 'OPEN'
    and (session.opened_by = v_profile or public.current_role() = 'OWNER')
  for update;
  if not found then raise exception 'Caja inválida o abierta por otro usuario'; end if;

  update public.cash_sessions set
    status = 'CLOSED', closed_by = v_profile, expected_amount = v_expected,
    counted_amount = p_counted, difference = p_counted - v_expected,
    closed_at = now(), notes = nullif(btrim(p_notes), '')
  where id = p_session;
end;
$$;

create or replace function public.complete_sale(
  p_cash_session uuid,
  p_customer uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_sale uuid;
  v_item jsonb;
  v_payment jsonb;
  v_sale_item uuid;
  v_lot public.inventory_lots%rowtype;
  v_remaining integer;
  v_allocated integer;
  v_total numeric(14,2) := 0;
  v_subtotal numeric(14,2);
  v_paid numeric(14,2) := 0;
  v_previous integer;
  v_variant uuid;
  v_owner uuid;
begin
  if v_profile is null or v_business is null or not public.has_permission('sales.create') then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La venta no tiene productos'; end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'La venta no tiene pagos'; end if;
  if coalesce(p_discount, 0) < 0 then raise exception 'Descuento inválido'; end if;
  if p_customer is not null and not exists(select 1 from public.customers where id = p_customer and business_id = v_business and active) then raise exception 'Cliente inválido'; end if;
  if not exists(
    select 1 from public.cash_sessions
    where id = p_cash_session and business_id = v_business and status = 'OPEN'
      and (opened_by = v_profile or public.current_role() = 'OWNER')
  ) then raise exception 'Caja cerrada o inválida'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item ->> 'quantity')::integer <= 0
      or (v_item ->> 'unit_price')::numeric < 0
      or coalesce((v_item ->> 'discount')::numeric, 0) < 0 then
      raise exception 'Producto de venta inválido';
    end if;
    v_subtotal := (v_item ->> 'quantity')::integer * (v_item ->> 'unit_price')::numeric
      - coalesce((v_item ->> 'discount')::numeric, 0);
    if v_subtotal < 0 then raise exception 'El descuento de un producto supera su importe'; end if;
    v_total := v_total + v_subtotal;
  end loop;
  v_total := round(v_total - coalesce(p_discount, 0), 2);
  if v_total < 0 then raise exception 'El descuento supera el total'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    if (v_payment ->> 'amount')::numeric <= 0 then raise exception 'Importe de pago inválido'; end if;
    if not exists(
      select 1 from public.payment_methods method
      where method.id = (v_payment ->> 'payment_method_id')::uuid
        and method.business_id = v_business
        and (method.active or method.code = 'EXCHANGE_CREDIT')
    ) then raise exception 'Tipo de pago inválido'; end if;
    v_paid := v_paid + (v_payment ->> 'amount')::numeric;
  end loop;
  if round(v_paid, 2) <> v_total then raise exception 'Los pagos no coinciden con el total'; end if;

  insert into public.sales(business_id, cashier_id, customer_id, cash_session_id, subtotal, discount, total)
  values(v_business, v_profile, p_customer, p_cash_session, v_total + coalesce(p_discount, 0), coalesce(p_discount, 0), v_total)
  returning id into v_sale;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant := (v_item ->> 'variant_id')::uuid;
    v_owner := (v_item ->> 'owner_id')::uuid;
    if not exists(select 1 from public.product_variants where id = v_variant and business_id = v_business and active) then raise exception 'Variante inválida'; end if;
    if not exists(select 1 from public.owners where id = v_owner and business_id = v_business and active) then raise exception 'Dueño inválido'; end if;

    v_remaining := (v_item ->> 'quantity')::integer;
    v_subtotal := v_remaining * (v_item ->> 'unit_price')::numeric - coalesce((v_item ->> 'discount')::numeric, 0);
    insert into public.sale_items(sale_id, variant_id, quantity, unit_price, discount, subtotal)
    values(v_sale, v_variant, v_remaining, (v_item ->> 'unit_price')::numeric, coalesce((v_item ->> 'discount')::numeric, 0), v_subtotal)
    returning id into v_sale_item;

    for v_lot in
      select * from public.inventory_lots
      where business_id = v_business and variant_id = v_variant and owner_id = v_owner and available_quantity > 0 and active
      order by received_at, id for update
    loop
      exit when v_remaining = 0;
      v_allocated := least(v_remaining, v_lot.available_quantity);
      update public.inventory_lots set available_quantity = available_quantity - v_allocated where id = v_lot.id;
      insert into public.sale_item_allocations(sale_item_id, owner_id, lot_id, quantity, unit_cost)
      values(v_sale_item, v_lot.owner_id, v_lot.id, v_allocated, v_lot.unit_cost);
      v_remaining := v_remaining - v_allocated;
    end loop;
    if v_remaining > 0 then raise exception 'Stock insuficiente'; end if;

    select quantity into v_previous from public.inventory_balances
    where business_id = v_business and variant_id = v_variant and owner_id = v_owner for update;
    if not found or v_previous < (v_item ->> 'quantity')::integer then raise exception 'Stock insuficiente'; end if;
    update public.inventory_balances set quantity = quantity - (v_item ->> 'quantity')::integer, updated_at = now()
    where business_id = v_business and variant_id = v_variant and owner_id = v_owner;
    insert into public.stock_movements(business_id, variant_id, owner_id, quantity, movement_type, previous_stock, resulting_stock, performed_by, reference_id, reference_type)
    values(v_business, v_variant, v_owner, -(v_item ->> 'quantity')::integer, 'SALE', v_previous,
      v_previous - (v_item ->> 'quantity')::integer, v_profile, v_sale, 'SALE');
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    insert into public.sale_payments(sale_id, payment_method_id, amount, external_reference)
    values(v_sale, (v_payment ->> 'payment_method_id')::uuid, (v_payment ->> 'amount')::numeric, v_payment ->> 'reference');
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, payment_method_id, reference_id, description, performed_by)
    values(v_business, p_cash_session, 'SALE', (v_payment ->> 'amount')::numeric,
      (v_payment ->> 'payment_method_id')::uuid, v_sale, 'Venta', v_profile);
  end loop;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, 'CREATE', 'SALE', v_sale);
  return v_sale;
end;
$$;

create or replace function public.register_return(
  p_sale uuid,
  p_allocations jsonb,
  p_reason text,
  p_refund numeric default 0,
  p_cash_session uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_return uuid;
  v_input jsonb;
  v_allocation public.sale_item_allocations%rowtype;
  v_sale_item public.sale_items%rowtype;
  v_previous integer;
  v_total_sold integer;
  v_total_returned integer;
begin
  if public.current_role() <> 'OWNER'
    and not public.has_permission('returns.create')
    and not (public.has_permission('exchanges.create') and lower(coalesce(p_reason, '')) = 'cambio')
  then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then raise exception 'No hay productos para devolver'; end if;
  if coalesce(p_refund, 0) < 0 then raise exception 'Reintegro inválido'; end if;
  if not exists(select 1 from public.sales where id = p_sale and business_id = v_business and status in('COMPLETED','PARTIALLY_RETURNED')) then raise exception 'Venta no disponible'; end if;
  if p_refund > 0 and not exists(
    select 1 from public.cash_sessions where id = p_cash_session and business_id = v_business and status = 'OPEN'
      and (opened_by = v_profile or public.current_role() = 'OWNER')
  ) then raise exception 'Se requiere una caja abierta para reintegrar'; end if;

  insert into public.returns(business_id, original_sale_id, cash_session_id, processed_by, reason, refund_amount)
  values(v_business, p_sale, p_cash_session, v_profile, coalesce(nullif(btrim(p_reason), ''), 'Devolución'), coalesce(p_refund, 0))
  returning id into v_return;

  for v_input in select value from jsonb_array_elements(p_allocations)
  loop
    select allocation.* into v_allocation
    from public.sale_item_allocations allocation
    join public.sale_items item on item.id = allocation.sale_item_id
    where allocation.id = (v_input ->> 'allocation_id')::uuid and item.sale_id = p_sale
    for update of allocation;
    if not found then raise exception 'Asignación de venta inválida'; end if;
    select * into v_sale_item from public.sale_items where id = v_allocation.sale_item_id;
    if (v_input ->> 'quantity')::integer <= 0 or (v_input ->> 'quantity')::integer > v_allocation.quantity - coalesce((
      select sum(item.quantity) from public.return_items item where item.sale_item_allocation_id = v_allocation.id
    ), 0) then raise exception 'Cantidad de devolución inválida'; end if;

    insert into public.return_items(return_id, sale_item_allocation_id, quantity, condition)
    values(v_return, v_allocation.id, (v_input ->> 'quantity')::integer, coalesce(v_input ->> 'condition', 'GOOD'));
    update public.inventory_lots set available_quantity = available_quantity + (v_input ->> 'quantity')::integer
    where id = v_allocation.lot_id;
    select quantity into v_previous from public.inventory_balances
    where business_id = v_business and variant_id = v_sale_item.variant_id and owner_id = v_allocation.owner_id for update;
    update public.inventory_balances set quantity = quantity + (v_input ->> 'quantity')::integer, updated_at = now()
    where business_id = v_business and variant_id = v_sale_item.variant_id and owner_id = v_allocation.owner_id;
    insert into public.stock_movements(business_id, variant_id, owner_id, lot_id, quantity, movement_type, previous_stock, resulting_stock, performed_by, reference_id, reference_type, notes)
    values(v_business, v_sale_item.variant_id, v_allocation.owner_id, v_allocation.lot_id,
      (v_input ->> 'quantity')::integer, 'RETURN', v_previous,
      v_previous + (v_input ->> 'quantity')::integer, v_profile, v_return, 'RETURN', p_reason);
  end loop;

  if p_refund > 0 then
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, reference_id, description, performed_by)
    values(v_business, p_cash_session, 'REFUND', -p_refund, v_return, 'Devolución', v_profile);
  end if;

  select coalesce(sum(quantity), 0) into v_total_sold from public.sale_items where sale_id = p_sale;
  select coalesce(sum(returned.quantity), 0) into v_total_returned
  from public.return_items returned
  join public.sale_item_allocations allocation on allocation.id = returned.sale_item_allocation_id
  join public.sale_items item on item.id = allocation.sale_item_id
  where item.sale_id = p_sale;
  update public.sales set status = case
    when v_total_returned >= v_total_sold then 'RETURNED'::public.sale_status
    else 'PARTIALLY_RETURNED'::public.sale_status end
  where id = p_sale;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'CREATE', 'RETURN', v_return, jsonb_build_object('sale_id', p_sale));
  return v_return;
end;
$$;

create or replace function public.create_and_confirm_purchase(
  p_supplier uuid,
  p_owner uuid,
  p_receipt_number text,
  p_purchased_at timestamptz,
  p_discount numeric,
  p_tax numeric,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_purchase uuid;
  v_item jsonb;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La compra no tiene productos'; end if;
  if not exists(select 1 from public.owners where id = p_owner and business_id = v_business and active) then raise exception 'Dueño inválido'; end if;
  if p_supplier is not null and not exists(select 1 from public.suppliers where id = p_supplier and business_id = v_business and active) then raise exception 'Proveedor inválido'; end if;
  if coalesce(p_discount, 0) < 0 or coalesce(p_tax, 0) < 0 then raise exception 'Importes inválidos'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item ->> 'quantity')::integer <= 0
      or (v_item ->> 'unit_cost')::numeric < 0
      or coalesce((v_item ->> 'discount')::numeric, 0) < 0 then raise exception 'Producto de compra inválido'; end if;
    if not exists(select 1 from public.product_variants where id = (v_item ->> 'variant_id')::uuid and business_id = v_business and active) then raise exception 'Variante inválida'; end if;
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::integer * (v_item ->> 'unit_cost')::numeric - coalesce((v_item ->> 'discount')::numeric, 0);
  end loop;
  v_total := round(v_subtotal - coalesce(p_discount, 0) + coalesce(p_tax, 0), 2);
  if v_total < 0 then raise exception 'El descuento supera el subtotal'; end if;

  insert into public.purchases(business_id, supplier_id, owner_id, created_by, receipt_number, purchased_at, subtotal, discount, tax, total, notes)
  values(v_business, p_supplier, p_owner, v_profile, nullif(btrim(p_receipt_number), ''), coalesce(p_purchased_at, now()),
    v_subtotal, coalesce(p_discount, 0), coalesce(p_tax, 0), v_total, nullif(btrim(p_notes), ''))
  returning id into v_purchase;

  insert into public.purchase_items(purchase_id, variant_id, quantity, unit_cost, discount)
  select v_purchase, (entry.value ->> 'variant_id')::uuid, (entry.value ->> 'quantity')::integer,
    (entry.value ->> 'unit_cost')::numeric, coalesce((entry.value ->> 'discount')::numeric, 0)
  from jsonb_array_elements(p_items) entry;

  perform public.confirm_purchase(v_purchase);
  return v_purchase;
end;
$$;

create or replace function public.save_product(p_product_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_product uuid;
  v_variant jsonb;
  v_image jsonb;
  v_variant_id uuid;
  v_size_id uuid;
  v_color_id uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_business is null then raise exception 'No existe un comercio activo'; end if;
  if p_product_id is null and public.current_role() <> 'OWNER' and not public.has_permission('products.create') then raise exception 'Permiso denegado'; end if;
  if p_product_id is not null and public.current_role() <> 'OWNER' and not public.has_permission('products.update') then raise exception 'Permiso denegado'; end if;
  if nullif(btrim(p_data ->> 'name'), '') is null or nullif(btrim(p_data ->> 'sku'), '') is null then raise exception 'Nombre y SKU son obligatorios'; end if;
  if (p_data ->> 'base_price')::numeric < 0 or coalesce((p_data ->> 'base_cost')::numeric, 0) < 0 then raise exception 'Precios inválidos'; end if;
  if jsonb_typeof(p_data -> 'variants') <> 'array' or jsonb_array_length(p_data -> 'variants') = 0 then raise exception 'El producto debe tener al menos una variante'; end if;
  if nullif(p_data ->> 'category_id', '') is not null and not exists(select 1 from public.categories where id = (p_data ->> 'category_id')::uuid and business_id = v_business) then raise exception 'Categoría inválida'; end if;
  if nullif(p_data ->> 'brand_id', '') is not null and not exists(select 1 from public.brands where id = (p_data ->> 'brand_id')::uuid and business_id = v_business) then raise exception 'Marca inválida'; end if;

  if p_product_id is null then
    insert into public.products(business_id, sku, name, description, category_id, brand_id, base_cost, base_price, promotional_price, minimum_stock, active)
    values(v_business, btrim(p_data ->> 'sku'), btrim(p_data ->> 'name'), nullif(btrim(p_data ->> 'description'), ''),
      nullif(p_data ->> 'category_id', '')::uuid, nullif(p_data ->> 'brand_id', '')::uuid,
      nullif(p_data ->> 'base_cost', '')::numeric, (p_data ->> 'base_price')::numeric,
      nullif(p_data ->> 'promotional_price', '')::numeric, coalesce((p_data ->> 'minimum_stock')::integer, 0),
      coalesce((p_data ->> 'active')::boolean, true))
    returning id into v_product;
  else
    update public.products set
      sku = btrim(p_data ->> 'sku'), name = btrim(p_data ->> 'name'), description = nullif(btrim(p_data ->> 'description'), ''),
      category_id = nullif(p_data ->> 'category_id', '')::uuid, brand_id = nullif(p_data ->> 'brand_id', '')::uuid,
      base_cost = nullif(p_data ->> 'base_cost', '')::numeric, base_price = (p_data ->> 'base_price')::numeric,
      promotional_price = nullif(p_data ->> 'promotional_price', '')::numeric,
      minimum_stock = coalesce((p_data ->> 'minimum_stock')::integer, 0), active = coalesce((p_data ->> 'active')::boolean, true)
    where id = p_product_id and business_id = v_business returning id into v_product;
    if v_product is null then raise exception 'Producto inexistente'; end if;
  end if;

  for v_variant in select value from jsonb_array_elements(p_data -> 'variants')
  loop
    if nullif(btrim(v_variant ->> 'sku'), '') is null or nullif(btrim(v_variant ->> 'barcode'), '') is null then raise exception 'Cada variante necesita SKU y código de barras'; end if;
    if (v_variant ->> 'price')::numeric < 0 or coalesce((v_variant ->> 'cost')::numeric, 0) < 0 then raise exception 'Precio de variante inválido'; end if;

    v_size_id := null;
    if nullif(btrim(v_variant ->> 'size'), '') is not null then
      insert into public.sizes(business_id, name) values(v_business, btrim(v_variant ->> 'size'))
      on conflict(business_id, name) do update set active = true returning id into v_size_id;
    end if;
    v_color_id := null;
    if nullif(btrim(v_variant ->> 'color'), '') is not null then
      insert into public.colors(business_id, name) values(v_business, btrim(v_variant ->> 'color'))
      on conflict(business_id, name) do update set active = true returning id into v_color_id;
    end if;

    v_variant_id := coalesce(nullif(v_variant ->> 'id', '')::uuid, gen_random_uuid());
    if exists(select 1 from public.product_variants where id = v_variant_id and (business_id <> v_business or product_id <> v_product)) then raise exception 'Variante inválida'; end if;
    insert into public.product_variants(id, business_id, product_id, size_id, color_id, sku, barcode, cost, price, minimum_stock, active)
    values(v_variant_id, v_business, v_product, v_size_id, v_color_id, btrim(v_variant ->> 'sku'), btrim(v_variant ->> 'barcode'),
      nullif(v_variant ->> 'cost', '')::numeric, (v_variant ->> 'price')::numeric,
      coalesce((p_data ->> 'minimum_stock')::integer, 0), coalesce((v_variant ->> 'active')::boolean, true))
    on conflict(id) do update set size_id = excluded.size_id, color_id = excluded.color_id, sku = excluded.sku,
      barcode = excluded.barcode, cost = excluded.cost, price = excluded.price,
      minimum_stock = excluded.minimum_stock, active = excluded.active;
    v_seen := array_append(v_seen, v_variant_id);
  end loop;
  update public.product_variants set active = false
  where product_id = v_product and business_id = v_business and not (id = any(v_seen));

  delete from public.product_images where product_id = v_product;
  if jsonb_typeof(p_data -> 'images') = 'array' then
    for v_image in select value from jsonb_array_elements(p_data -> 'images')
    loop
      if nullif(v_image ->> 'path', '') is not null then
        insert into public.product_images(product_id, storage_path, sort_order)
        values(v_product, v_image ->> 'path', coalesce((v_image ->> 'order')::integer, 0));
      end if;
    end loop;
  end if;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, public.current_profile_id(), case when p_product_id is null then 'CREATE' else 'UPDATE' end, 'PRODUCT', v_product);
  return v_product;
end;
$$;

revoke all on function public.open_cash_register(uuid,numeric),
  public.close_cash_register(uuid,numeric,text),
  public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),
  public.register_return(uuid,jsonb,text,numeric,uuid),
  public.save_product(uuid,jsonb),
  public.create_and_confirm_purchase(uuid,uuid,text,timestamptz,numeric,numeric,text,jsonb) from public;
grant execute on function public.open_cash_register(uuid,numeric),
  public.close_cash_register(uuid,numeric,text),
  public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),
  public.register_return(uuid,jsonb,text,numeric,uuid),
  public.save_product(uuid,jsonb),
  public.create_and_confirm_purchase(uuid,uuid,text,timestamptz,numeric,numeric,text,jsonb) to authenticated;

commit;
