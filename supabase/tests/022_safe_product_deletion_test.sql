begin;

insert into public.businesses(id, name)
values('22000000-0000-4000-8000-000000000001', 'Prueba borrado 022');

insert into public.profiles(id, auth_user_id, business_id, first_name, last_name, email, role)
values(
  '22000000-0000-4000-8000-000000000002',
  '9cce2750-ff96-4c16-bc01-df86c03017e6',
  '22000000-0000-4000-8000-000000000001',
  'Prueba', 'VESTIA', 'test-022@vestia.local', 'OWNER'
);

select set_config('request.jwt.claim.sub', '9cce2750-ff96-4c16-bc01-df86c03017e6', true);
set local role authenticated;

do $$
declare
  v_product uuid;
begin
  v_product := public.save_product_complete(null, jsonb_build_object(
    'name', 'Producto borrable 022',
    'sku', 'BOR-022',
    'internal_code', 'INT-BOR-022',
    'barcode', '220000000001',
    'description', 'Producto sin categoría ni marca',
    'category_id', null,
    'brand_id', null,
    'base_cost', 100,
    'base_price', 250,
    'promotional_price', null,
    'minimum_stock', 0,
    'maximum_stock', 0,
    'active', true,
    'images', '[]'::jsonb,
    'variants', jsonb_build_array(jsonb_build_object(
      'id', '22000000-0000-4000-8000-000000000003',
      'color', 'Sin color',
      'size', 'Único',
      'sku', 'BOR-022-V01',
      'barcode', '220000000002',
      'cost', 100,
      'price', 250,
      'active', true
    ))
  ));

  perform public.delete_product(v_product);

  if not exists(
    select 1 from public.products
    where id = v_product and not active and deleted_at is not null
  ) then
    raise exception 'El producto no quedó borrado del catálogo';
  end if;
  if exists(
    select 1 from public.product_variants
    where product_id = v_product and active
  ) then
    raise exception 'Las variantes del producto borrado siguen activas';
  end if;
  if exists(
    select 1 from public.product_labels
    where product_id = v_product and active
  ) then
    raise exception 'Las etiquetas del producto borrado siguen activas';
  end if;
  if not exists(
    select 1 from public.audit_logs
    where entity_id = v_product and action = 'DELETE' and entity_type = 'PRODUCT'
  ) then
    raise exception 'El borrado no fue auditado';
  end if;
end;
$$;

rollback;
