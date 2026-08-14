-- Permitir que platform owners actualicen y eliminen comercios
grant update, delete on public.businesses to authenticated;

create policy businesses_platform_update on public.businesses
for update to authenticated using(public.is_platform_owner());

create policy businesses_platform_delete on public.businesses
for delete to authenticated using(public.is_platform_owner());
