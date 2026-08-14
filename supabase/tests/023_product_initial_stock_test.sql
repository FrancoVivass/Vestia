begin;

insert into public.businesses(id, name)
values('23000000-0000-4000-8000-000000000001', 'Prueba stock inicial 023');
insert into public.profiles(id, auth_user_id, business_id, first_name, last_name, email, role)
values(
  '23000000-0000-4000-8000-000000000002','9cce2750-ff96-4c16-bc01-df86c03017e6',
  '23000000-0000-4000-8000-000000000001','Prueba','VESTIA','test-023@vestia.local','OWNER'
);
select set_config('request.jwt.claim.sub', '9cce2750-ff96-4c16-bc01-df86c03017e6', true);
set local role authenticated;

do $$
declare v_product uuid; v_owner uuid;
begin
  v_product := public.save_product_complete(null,jsonb_build_object(
    'name','Producto stock 023','sku','STOCK-023','internal_code','INT-STOCK-023','barcode','230000000001',
    'description','','category_id',null,'brand_id',null,'base_cost',100,'base_price',250,'promotional_price',null,
    'minimum_stock',1,'maximum_stock',10,'active',true,'images','[]'::jsonb,
    'variants',jsonb_build_array(jsonb_build_object(
      'id','23000000-0000-4000-8000-000000000003','color','Negro','size','M','sku','STOCK-023-V01',
      'barcode','230000000002','cost',100,'price',250,'active',true,'initial_stock',5,'owner_id',null
    ))
  ));
  select id into v_owner from public.owners where business_id='23000000-0000-4000-8000-000000000001';
  if v_owner is null then raise exception 'No se creó el dueño de stock automático'; end if;
  if not exists(select 1 from public.inventory_balances where variant_id='23000000-0000-4000-8000-000000000003' and owner_id=v_owner and quantity=5) then raise exception 'No se creó el saldo inicial'; end if;
  if not exists(select 1 from public.inventory_lots where variant_id='23000000-0000-4000-8000-000000000003' and available_quantity=5) then raise exception 'No se creó el lote inicial'; end if;
  if not exists(select 1 from public.stock_movements where variant_id='23000000-0000-4000-8000-000000000003' and quantity=5 and reference_type='PRODUCT_STOCK_ENTRY') then raise exception 'No se auditó el movimiento inicial'; end if;

  perform public.save_product_complete(v_product,jsonb_build_object(
    'name','Producto stock 023','sku','STOCK-023','internal_code','INT-STOCK-023','barcode','230000000001',
    'description','','category_id',null,'brand_id',null,'base_cost',100,'base_price',250,'promotional_price',null,
    'minimum_stock',1,'maximum_stock',10,'active',true,'images','[]'::jsonb,
    'variants',jsonb_build_array(jsonb_build_object(
      'id','23000000-0000-4000-8000-000000000003','color','Negro','size','M','sku','STOCK-023-V01',
      'barcode','230000000002','cost',100,'price',250,'active',true,'initial_stock',2,'owner_id',v_owner
    ))
  ));
  if not exists(select 1 from public.inventory_balances where variant_id='23000000-0000-4000-8000-000000000003' and owner_id=v_owner and quantity=7) then raise exception 'No se pudo agregar stock editando el producto'; end if;
end;
$$;

rollback;
