begin;

do $$
declare
  v_auth uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_business uuid;
begin
  select business_id into v_business from public.profiles where auth_user_id=v_auth;
  if v_business is null then return; end if;

  if (select count(*) from public.profiles where business_id=v_business)<>1
    or exists(select 1 from public.sales where business_id=v_business)
    or exists(select 1 from public.purchases where business_id=v_business)
    or exists(select 1 from public.products where business_id=v_business)
    or exists(select 1 from public.owners where business_id=v_business)
    or exists(select 1 from public.customers where business_id=v_business)
  then raise exception 'El comercio asociado al propietario de plataforma contiene datos y no puede limpiarse automáticamente';
  end if;

  delete from public.profile_permissions where profile_id in(select id from public.profiles where auth_user_id=v_auth);
  delete from public.profiles where auth_user_id=v_auth;
  delete from public.app_settings where business_id=v_business;
  delete from public.sizes where business_id=v_business;
  delete from public.colors where business_id=v_business;
  delete from public.categories where business_id=v_business;
  delete from public.brands where business_id=v_business;
  delete from public.payment_methods where business_id=v_business;
  delete from public.cash_registers where business_id=v_business;
  delete from public.suppliers where business_id=v_business;
  delete from public.businesses where id=v_business;
end $$;

commit;
