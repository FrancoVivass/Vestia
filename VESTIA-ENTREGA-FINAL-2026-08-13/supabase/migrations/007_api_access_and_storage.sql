begin;

drop policy if exists purchases_owner_insert on public.purchases;
drop policy if exists purchases_owner_update on public.purchases;
drop policy if exists purchase_items_owner_write on public.purchase_items;
drop policy if exists customers_cashier_insert on public.customers;
drop policy if exists customers_cashier_update on public.customers;
drop policy if exists storage_business_read on storage.objects;
drop policy if exists storage_owner_insert on storage.objects;
drop policy if exists storage_owner_update on storage.objects;
drop policy if exists storage_owner_delete on storage.objects;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant insert,update on public.owners,public.categories,public.brands,public.sizes,public.colors,
  public.suppliers,public.products,public.product_images,public.product_variants,public.customers,
  public.purchases,public.purchase_items,public.profiles,public.profile_permissions,
  public.payment_methods,public.cash_registers,public.app_settings to authenticated;

grant delete on public.profile_permissions,public.product_images to authenticated;

alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant usage,select on sequences to authenticated;

create policy purchases_owner_insert on public.purchases for insert to authenticated
with check(business_id=public.current_business_id() and public.current_role()='OWNER' and created_by=public.current_profile_id());

create policy purchases_owner_update on public.purchases for update to authenticated
using(business_id=public.current_business_id() and public.current_role()='OWNER' and status='DRAFT')
with check(business_id=public.current_business_id() and public.current_role()='OWNER');

create policy purchase_items_owner_write on public.purchase_items for all to authenticated
using(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id() and p.status='DRAFT'))
with check(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id() and p.status='DRAFT'));

create policy customers_cashier_insert on public.customers for insert to authenticated
with check(business_id=public.current_business_id() and public.has_permission('customers.create'));

create policy customers_cashier_update on public.customers for update to authenticated
using(business_id=public.current_business_id() and public.has_permission('customers.create'))
with check(business_id=public.current_business_id() and public.has_permission('customers.create'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('business-assets','business-assets',false,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('product-images','product-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_business_read on storage.objects for select to authenticated
using(bucket_id in('business-assets','product-images') and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_insert on storage.objects for insert to authenticated
with check(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_update on storage.objects for update to authenticated
using(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text)
with check(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_delete on storage.objects for delete to authenticated
using(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

commit;
