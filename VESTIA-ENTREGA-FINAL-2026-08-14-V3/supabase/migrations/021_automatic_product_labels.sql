begin;

create table if not exists public.product_labels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  sku text not null,
  barcode text not null,
  active boolean not null default true,
  print_count integer not null default 0 check(print_count >= 0),
  last_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, barcode)
);

create index if not exists product_labels_business_product_idx
  on public.product_labels(business_id, product_id);

alter table public.product_labels enable row level security;
drop policy if exists product_labels_owner_read on public.product_labels;
create policy product_labels_owner_read on public.product_labels
for select to authenticated
using(business_id=public.current_business_id() and public.current_role()='OWNER');

grant select on public.product_labels to authenticated;

create or replace function public.sync_product_variant_label()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.product_labels(business_id,product_id,variant_id,sku,barcode,active)
  values(new.business_id,new.product_id,new.id,new.sku,new.barcode,new.active)
  on conflict(variant_id) do update set
    business_id=excluded.business_id,
    product_id=excluded.product_id,
    sku=excluded.sku,
    barcode=excluded.barcode,
    active=excluded.active,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists product_variants_sync_label on public.product_variants;
create trigger product_variants_sync_label
after insert or update of sku,barcode,active,product_id on public.product_variants
for each row execute function public.sync_product_variant_label();

insert into public.product_labels(business_id,product_id,variant_id,sku,barcode,active)
select variant.business_id,variant.product_id,variant.id,variant.sku,variant.barcode,variant.active
from public.product_variants variant
on conflict(variant_id) do update set
  sku=excluded.sku,barcode=excluded.barcode,active=excluded.active,updated_at=now();

create or replace function public.mark_product_labels_printed(p_variant_ids uuid[])
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if public.current_role()<>'OWNER' then raise exception 'Permiso denegado'; end if;
  update public.product_labels
  set print_count=print_count+1,last_printed_at=now(),updated_at=now()
  where business_id=public.current_business_id() and variant_id=any(p_variant_ids) and active;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_product_labels_printed(uuid[]) from public;
grant execute on function public.mark_product_labels_printed(uuid[]) to authenticated;

commit;
