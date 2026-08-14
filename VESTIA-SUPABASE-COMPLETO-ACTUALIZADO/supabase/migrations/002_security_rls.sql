begin;

create or replace function public.current_profile_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.current_business_id() returns uuid language sql stable security definer set search_path=public as $$
  select business_id from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.has_permission(p_code text) returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id=auth.uid() and p.active and (
      p.role='OWNER' or coalesce((select pp.enabled from public.profile_permissions pp where pp.profile_id=p.id and pp.permission_code=p_code),
      (select rp.enabled from public.role_permissions rp where rp.role=p.role and rp.permission_code=p_code), false)
    )
  )
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_business_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_profile_id(), public.current_business_id(), public.current_role(), public.has_permission(text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['businesses','owners','profiles','permissions','role_permissions','profile_permissions','categories','brands','sizes','colors','suppliers','products','product_images','product_variants','customers','purchases','purchase_items','inventory_lots','inventory_balances','stock_movements','cash_registers','cash_sessions','sales','sale_items','sale_item_allocations','payment_methods','sale_payments','cash_movements','returns','return_items','exchanges','physical_inventories','physical_inventory_items','owner_settlements','audit_logs','app_settings']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy businesses_read on public.businesses for select to authenticated using(id=public.current_business_id());
create policy profiles_read on public.profiles for select to authenticated using(business_id=public.current_business_id());
create policy profiles_owner_write on public.profiles for all to authenticated using(business_id=public.current_business_id() and public.current_role()='OWNER') with check(business_id=public.current_business_id() and public.current_role()='OWNER');
create policy permissions_read on public.permissions for select to authenticated using(true);
create policy role_permissions_read on public.role_permissions for select to authenticated using(true);
create policy profile_permissions_owner on public.profile_permissions for all to authenticated using(public.current_role()='OWNER') with check(public.current_role()='OWNER');

do $$ declare t text; begin
  foreach t in array array['owners','categories','brands','sizes','colors','suppliers','products','product_variants','customers','payment_methods','cash_registers','app_settings']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (business_id=public.current_business_id())', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (business_id=public.current_business_id() and public.current_role()=''OWNER'') with check (business_id=public.current_business_id() and public.current_role()=''OWNER'')', t||'_owner_write', t);
  end loop;
end $$;

create policy product_images_read on public.product_images for select to authenticated using(exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id()));
create policy product_images_write on public.product_images for all to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id())) with check(public.current_role()='OWNER' and exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id()));

do $$ declare t text; begin
  foreach t in array array['purchases','inventory_lots','inventory_balances','stock_movements','physical_inventories','owner_settlements','audit_logs']
  loop execute format('create policy %I on public.%I for select to authenticated using (business_id=public.current_business_id() and public.current_role()=''OWNER'')', t||'_owner_read',t); end loop;
end $$;
create policy inventory_balances_cashier_read on public.inventory_balances for select to authenticated using(business_id=public.current_business_id() and public.has_permission('stock.read'));
create policy sales_read on public.sales for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or cashier_id=public.current_profile_id()));
create policy cash_sessions_read on public.cash_sessions for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or opened_by=public.current_profile_id()));
create policy cash_movements_read on public.cash_movements for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or performed_by=public.current_profile_id()));
create policy returns_read on public.returns for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or processed_by=public.current_profile_id()));
create policy exchanges_read on public.exchanges for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or processed_by=public.current_profile_id()));

create policy purchase_items_owner_read on public.purchase_items for select to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id()));
create policy sale_items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy allocations_read on public.sale_item_allocations for select to authenticated using(exists(select 1 from public.sale_items si join public.sales s on s.id=si.sale_id where si.id=sale_item_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy payments_read on public.sale_payments for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy return_items_read on public.return_items for select to authenticated using(exists(select 1 from public.returns r where r.id=return_id and r.business_id=public.current_business_id() and (public.current_role()='OWNER' or r.processed_by=public.current_profile_id())));
create policy inventory_items_owner on public.physical_inventory_items for select to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.physical_inventories i where i.id=inventory_id and i.business_id=public.current_business_id()));

commit;
