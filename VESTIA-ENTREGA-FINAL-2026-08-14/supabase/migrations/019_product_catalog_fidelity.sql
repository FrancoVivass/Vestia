begin;

alter table public.products
  add column if not exists internal_code text,
  add column if not exists barcode text,
  add column if not exists maximum_stock integer not null default 0;

update public.products product
set internal_code = coalesce(product.internal_code, product.sku),
    barcode = coalesce(product.barcode, (
      select variant.barcode from public.product_variants variant
      where variant.product_id = product.id order by variant.created_at, variant.id limit 1
    ));

alter table public.products drop constraint if exists products_maximum_stock_nonnegative;
alter table public.products add constraint products_maximum_stock_nonnegative check(maximum_stock >= 0);
create unique index if not exists products_business_internal_code_unique
  on public.products(business_id, internal_code) where internal_code is not null;
create unique index if not exists products_business_barcode_unique
  on public.products(business_id, barcode) where barcode is not null;

create or replace function public.save_product_complete(p_product_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
  v_business uuid := public.current_business_id();
  v_minimum integer := coalesce((p_data ->> 'minimum_stock')::integer, 0);
  v_maximum integer := coalesce((p_data ->> 'maximum_stock')::integer, 0);
begin
  if nullif(btrim(p_data ->> 'internal_code'), '') is null then
    raise exception 'El código interno es obligatorio';
  end if;
  if nullif(btrim(p_data ->> 'barcode'), '') is null then
    raise exception 'El código de barras general es obligatorio';
  end if;
  if v_maximum < 0 or (v_maximum > 0 and v_maximum < v_minimum) then
    raise exception 'El stock máximo debe ser cero o mayor o igual al stock mínimo';
  end if;

  v_product := public.save_product(p_product_id, p_data);
  update public.products
  set internal_code = btrim(p_data ->> 'internal_code'),
      barcode = btrim(p_data ->> 'barcode'),
      maximum_stock = v_maximum
  where id = v_product and business_id = v_business;
  return v_product;
end;
$$;

revoke all on function public.save_product_complete(uuid,jsonb) from public;
grant execute on function public.save_product_complete(uuid,jsonb) to authenticated;

commit;
