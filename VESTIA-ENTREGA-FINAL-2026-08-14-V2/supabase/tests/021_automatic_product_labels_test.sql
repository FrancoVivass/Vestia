begin;

insert into public.businesses(id, name)
values('21000000-0000-4000-8000-000000000001', 'Prueba etiquetas 021');

insert into public.profiles(id, auth_user_id, business_id, first_name, last_name, email, role)
values(
  '21000000-0000-4000-8000-000000000002',
  '9cce2750-ff96-4c16-bc01-df86c03017e6',
  '21000000-0000-4000-8000-000000000001',
  'Prueba', 'VESTIA', 'test-021@vestia.local', 'OWNER'
);

select set_config('request.jwt.claim.sub', '9cce2750-ff96-4c16-bc01-df86c03017e6', true);
set local role authenticated;

insert into public.categories(id, business_id, name)
values('21000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000001', 'Categoría 021');
insert into public.brands(id, business_id, name)
values('21000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', 'Marca 021');
insert into public.colors(id, business_id, name, hex_code)
values('21000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000001', 'Negro 021', '#000000');
insert into public.sizes(id, business_id, name, sort_order)
values('21000000-0000-4000-8000-000000000006', '21000000-0000-4000-8000-000000000001', 'M 021', 1);

do $$
declare
  v_product uuid;
  v_marked integer;
begin
  v_product := public.save_product_complete(null, jsonb_build_object(
    'name', 'Remera etiqueta 021',
    'sku', 'REM-021',
    'internal_code', 'INT-021',
    'barcode', '210000000001',
    'description', 'Prueba automática de etiqueta',
    'category_id', '21000000-0000-4000-8000-000000000003',
    'brand_id', '21000000-0000-4000-8000-000000000004',
    'base_cost', 100,
    'base_price', 250,
    'promotional_price', null,
    'minimum_stock', 2,
    'maximum_stock', 20,
    'active', true,
    'images', '[]'::jsonb,
    'variants', jsonb_build_array(jsonb_build_object(
      'id', '21000000-0000-4000-8000-000000000007',
      'color', 'Negro 021',
      'size', 'M 021',
      'sku', 'REM-021-M',
      'barcode', '210000000002',
      'cost', 100,
      'price', 250,
      'active', true
    ))
  ));

  if not exists(
    select 1 from public.product_labels
    where product_id = v_product
      and variant_id = '21000000-0000-4000-8000-000000000007'
      and barcode = '210000000002'
      and active
      and print_count = 0
  ) then
    raise exception 'La etiqueta no se creó automáticamente';
  end if;

  v_marked := public.mark_product_labels_printed(array['21000000-0000-4000-8000-000000000007'::uuid]);
  if v_marked <> 1 or not exists(
    select 1 from public.product_labels
    where variant_id = '21000000-0000-4000-8000-000000000007'
      and print_count = 1
      and last_printed_at is not null
  ) then
    raise exception 'La impresión de la etiqueta no quedó registrada';
  end if;

  update public.product_variants set active = false
  where id = '21000000-0000-4000-8000-000000000007';
  if exists(
    select 1 from public.product_labels
    where variant_id = '21000000-0000-4000-8000-000000000007' and active
  ) then
    raise exception 'La etiqueta no se sincronizó al desactivar la variante';
  end if;
end;
$$;

rollback;
