begin;

alter table public.products
  add column if not exists deleted_at timestamptz;

create index if not exists products_visible_catalog_idx
  on public.products(business_id, active, name)
  where deleted_at is null;

create or replace function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
begin
  if v_business is null or v_profile is null then
    raise exception 'No existe un comercio activo';
  end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('products.delete') then
    raise exception 'Permiso denegado';
  end if;

  update public.products
  set active = false, deleted_at = now(), updated_at = now()
  where id = p_product_id and business_id = v_business and deleted_at is null;
  if not found then
    raise exception 'Producto inexistente o ya borrado';
  end if;

  update public.product_variants
  set active = false, updated_at = now()
  where product_id = p_product_id and business_id = v_business and active;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, 'DELETE', 'PRODUCT', p_product_id);
end;
$$;

revoke all on function public.delete_product(uuid) from public;
grant execute on function public.delete_product(uuid) to authenticated;

commit;
