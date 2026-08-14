begin;

do $$
declare
  v_auth uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_business uuid := gen_random_uuid();
  v_profile uuid := gen_random_uuid();
  v_variant uuid := gen_random_uuid();
  v_product uuid;
begin
  insert into public.businesses(id,name) values(v_business,'Prueba catálogo 019');
  insert into public.profiles(id,auth_user_id,business_id,first_name,last_name,email,role)
  values(v_profile,v_auth,v_business,'Prueba','VESTIA','test-019@vestia.local','OWNER');
  perform set_config('request.jwt.claim.sub',v_auth::text,true);

  v_product := public.save_product_complete(null,jsonb_build_object(
    'name','Remera prueba','sku','REM-019','internal_code','INT-019','barcode','190000000001',
    'description','Prueba de catálogo','category_id',null,'brand_id',null,
    'base_cost',100,'base_price',250,'promotional_price',null,'minimum_stock',2,'maximum_stock',20,'active',true,
    'images','[]'::jsonb,
    'variants',jsonb_build_array(jsonb_build_object(
      'id',v_variant,'color','Negro','size','M','sku','REM-019-M','barcode','190000000002','cost',100,'price',250,'active',true
    ))
  ));

  if not exists(
    select 1 from public.products where id=v_product and business_id=v_business
      and internal_code='INT-019' and barcode='190000000001' and maximum_stock=20 and minimum_stock=2
  ) then raise exception 'Los datos completos del producto no se guardaron'; end if;
  if not exists(
    select 1 from public.product_variants where id=v_variant and product_id=v_product and sku='REM-019-M'
  ) then raise exception 'La variante no se guardó'; end if;
end;
$$;

rollback;
