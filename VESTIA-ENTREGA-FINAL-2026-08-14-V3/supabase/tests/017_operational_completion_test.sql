begin;

do $$
declare
  v_auth uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_business uuid := gen_random_uuid();
  v_profile uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_variant uuid := gen_random_uuid();
  v_lot uuid := gen_random_uuid();
  v_register uuid := gen_random_uuid();
  v_cash_method uuid := gen_random_uuid();
  v_debit_method uuid := gen_random_uuid();
  v_session uuid;
  v_sale uuid;
  v_inventory uuid;
  v_settlement jsonb;
  v_summary jsonb;
  v_value numeric;
  v_count integer;
begin
  insert into public.businesses(id,name) values(v_business,'Prueba transaccional 017');
  insert into public.profiles(id,auth_user_id,business_id,first_name,last_name,email,role)
    values(v_profile,v_auth,v_business,'Prueba','VESTIA','test-017@vestia.local','OWNER');
  perform set_config('request.jwt.claim.sub',v_auth::text,true);

  insert into public.owners(id,business_id,first_name,last_name) values(v_owner,v_business,'Dueño','Prueba');
  insert into public.products(id,business_id,sku,name,base_cost,base_price) values(v_product,v_business,'TST-017','Producto prueba',30,100);
  insert into public.product_variants(id,business_id,product_id,sku,barcode,cost,price)
    values(v_variant,v_business,v_product,'TST-017-M','170000000001',30,100);
  insert into public.inventory_lots(id,business_id,variant_id,owner_id,unit_cost,initial_quantity,available_quantity)
    values(v_lot,v_business,v_variant,v_owner,30,5,5);
  insert into public.inventory_balances(business_id,variant_id,owner_id,quantity) values(v_business,v_variant,v_owner,5);
  insert into public.cash_registers(id,business_id,name) values(v_register,v_business,'Caja prueba');
  insert into public.payment_methods(id,business_id,code,name) values
    (v_cash_method,v_business,'CASH','Efectivo'),(v_debit_method,v_business,'DEBIT','Débito');
  insert into public.app_settings(business_id,store_name) values(v_business,'Prueba transaccional 017');

  v_session := public.open_cash_register(v_register,50);
  v_sale := public.complete_sale(v_session,null,
    jsonb_build_array(jsonb_build_object('variant_id',v_variant,'owner_id',v_owner,'quantity',1,'unit_price',100,'discount',0)),
    jsonb_build_array(
      jsonb_build_object('payment_method_id',v_cash_method,'amount',40),
      jsonb_build_object('payment_method_id',v_debit_method,'amount',60)
    ),0);

  if (select quantity from public.inventory_balances where business_id=v_business and variant_id=v_variant and owner_id=v_owner) <> 4 then
    raise exception 'La venta no descontó el stock esperado';
  end if;

  perform public.register_expense(v_session,'Flete','Logística',10,v_cash_method,v_owner,'Prueba',now());
  v_summary := public.cash_session_summary(v_session);
  if round((v_summary->>'expectedCash')::numeric,2) <> 80 then
    raise exception 'Efectivo esperado incorrecto después del gasto: %',v_summary;
  end if;

  v_inventory := public.start_physical_inventory('Prueba automatizada');
  perform public.set_physical_inventory_count(v_inventory,v_variant,v_owner,3);
  v_count := public.complete_physical_inventory(v_inventory);
  if v_count <> 1 or (select quantity from public.inventory_balances where business_id=v_business and variant_id=v_variant and owner_id=v_owner) <> 3 then
    raise exception 'El inventario físico no aplicó el ajuste';
  end if;

  v_settlement := public.create_owner_settlement(v_owner,current_date,current_date);
  if round((v_settlement->>'gross')::numeric,2) <> 100
    or round((v_settlement->>'cost')::numeric,2) <> 30
    or round((v_settlement->>'expenses')::numeric,2) <> 10
    or round((v_settlement->>'profit')::numeric,2) <> 60
    or (v_settlement->>'stock')::integer <> 3 then
    raise exception 'Liquidación incorrecta: %',v_settlement;
  end if;

  perform public.cancel_sale(v_sale,'Prueba automatizada');
  if (select status from public.sales where id=v_sale) <> 'CANCELLED' then raise exception 'La venta no quedó anulada'; end if;
  if (select quantity from public.inventory_balances where business_id=v_business and variant_id=v_variant and owner_id=v_owner) <> 4 then
    raise exception 'La anulación no restituyó el stock';
  end if;
  v_summary := public.cash_session_summary(v_session);
  if round((v_summary->>'expectedCash')::numeric,2) <> 40 then
    raise exception 'La anulación no revirtió correctamente el efectivo: %',v_summary;
  end if;

  perform public.update_business_identity('Prueba actualizada','Calle 1','123','test@vestia.local','ARS',null);
  if (select name from public.businesses where id=v_business) <> 'Prueba actualizada' then raise exception 'No se actualizó la identidad'; end if;

  select count(*) into v_count from public.audit_logs where business_id=v_business
    and entity_type in('SALE','EXPENSE','PHYSICAL_INVENTORY','OWNER_SETTLEMENT','BUSINESS');
  if v_count < 5 then raise exception 'Faltan eventos de auditoría'; end if;
end;
$$;

rollback;
