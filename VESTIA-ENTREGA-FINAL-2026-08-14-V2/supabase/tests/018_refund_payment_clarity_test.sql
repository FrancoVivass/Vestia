begin;

do $$
declare
  v_auth uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_business uuid := gen_random_uuid();
  v_profile uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_product_a uuid := gen_random_uuid();
  v_product_b uuid := gen_random_uuid();
  v_variant_a uuid := gen_random_uuid();
  v_variant_b uuid := gen_random_uuid();
  v_lot_a uuid := gen_random_uuid();
  v_lot_b uuid := gen_random_uuid();
  v_register uuid := gen_random_uuid();
  v_cash_method uuid := gen_random_uuid();
  v_session uuid;
  v_sale uuid;
  v_return uuid;
  v_allocation uuid;
  v_result jsonb;
  v_count integer;
begin
  insert into public.businesses(id, name) values(v_business, 'Prueba transaccional 018');
  insert into public.profiles(id, auth_user_id, business_id, first_name, last_name, email, role)
  values(v_profile, v_auth, v_business, 'Prueba', 'VESTIA', 'test-018@vestia.local', 'OWNER');
  perform set_config('request.jwt.claim.sub', v_auth::text, true);

  insert into public.owners(id, business_id, first_name, last_name)
  values(v_owner, v_business, 'Dueño', 'Prueba');
  insert into public.products(id, business_id, sku, name, base_cost, base_price) values
    (v_product_a, v_business, 'TST-018-A', 'Producto A', 30, 100),
    (v_product_b, v_business, 'TST-018-B', 'Producto B', 20, 80);
  insert into public.product_variants(id, business_id, product_id, sku, barcode, cost, price) values
    (v_variant_a, v_business, v_product_a, 'TST-018-A', '180000000001', 30, 100),
    (v_variant_b, v_business, v_product_b, 'TST-018-B', '180000000002', 20, 80);
  insert into public.inventory_lots(id, business_id, variant_id, owner_id, unit_cost, initial_quantity, available_quantity) values
    (v_lot_a, v_business, v_variant_a, v_owner, 30, 10, 10),
    (v_lot_b, v_business, v_variant_b, v_owner, 20, 10, 10);
  insert into public.inventory_balances(business_id, variant_id, owner_id, quantity) values
    (v_business, v_variant_a, v_owner, 10),
    (v_business, v_variant_b, v_owner, 10);
  insert into public.cash_registers(id, business_id, name) values(v_register, v_business, 'Caja prueba');
  insert into public.payment_methods(id, business_id, code, name)
  values(v_cash_method, v_business, 'CASH', 'Efectivo');
  insert into public.app_settings(business_id, store_name) values(v_business, 'Prueba transaccional 018');
  v_session := public.open_cash_register(v_register, 0);

  -- Devolución normal: el tipo de pago queda tanto en la devolución como en caja.
  v_sale := public.complete_sale(v_session, null,
    jsonb_build_array(jsonb_build_object('variant_id',v_variant_a,'owner_id',v_owner,'quantity',1,'unit_price',100,'discount',0)),
    jsonb_build_array(jsonb_build_object('payment_method_id',v_cash_method,'amount',100)), 0);
  select allocation.id into v_allocation
  from public.sale_item_allocations allocation
  join public.sale_items item on item.id = allocation.sale_item_id
  where item.sale_id = v_sale;
  v_return := public.register_return_with_method(v_sale,
    jsonb_build_array(jsonb_build_object('allocation_id',v_allocation,'quantity',1,'condition','GOOD')),
    'Devolución de prueba', 100, v_session, v_cash_method);
  if (select refund_payment_method_id from public.returns where id=v_return) <> v_cash_method then
    raise exception 'La devolución no guardó el tipo de pago';
  end if;
  if (select payment_method_id from public.cash_movements where reference_id=v_return and movement_type='REFUND') <> v_cash_method then
    raise exception 'El reintegro de caja no guardó el tipo de pago';
  end if;

  -- Cambio por un producto más barato: reintegra diferencia con tipo de pago explícito.
  v_sale := public.complete_sale(v_session, null,
    jsonb_build_array(jsonb_build_object('variant_id',v_variant_a,'owner_id',v_owner,'quantity',1,'unit_price',100,'discount',0)),
    jsonb_build_array(jsonb_build_object('payment_method_id',v_cash_method,'amount',100)), 0);
  select allocation.id into v_allocation
  from public.sale_item_allocations allocation
  join public.sale_items item on item.id = allocation.sale_item_id
  where item.sale_id = v_sale;
  v_result := public.register_exchange_with_method(v_sale,
    jsonb_build_array(jsonb_build_object('allocation_id',v_allocation,'quantity',1,'condition','GOOD')),
    'Cambio de prueba', v_session,
    jsonb_build_array(jsonb_build_object('variant_id',v_variant_b,'owner_id',v_owner,'quantity',1,'unit_price',80,'discount',0)),
    '[]'::jsonb, 0, v_cash_method);
  if round((v_result->>'difference')::numeric,2) <> -20 then
    raise exception 'La diferencia del cambio es incorrecta: %', v_result;
  end if;
  v_return := (v_result->>'return_id')::uuid;
  if (select refund_payment_method_id from public.returns where id=v_return) <> v_cash_method then
    raise exception 'El cambio no guardó el tipo de pago de la devolución';
  end if;

  -- El catálogo no crea integraciones externas: solo identifica el medio elegido.
  select count(*) into v_count
  from public.cash_movements
  where business_id=v_business and payment_method_id=v_cash_method and movement_type='REFUND';
  if v_count <> 2 then raise exception 'Cantidad inesperada de reintegros tipificados: %', v_count; end if;
end;
$$;

rollback;
