begin;

create table public.platform_owners (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.platform_owners enable row level security;

drop policy if exists platform_owner_self_read on public.platform_owners;
drop policy if exists businesses_platform_read on public.businesses;
drop policy if exists profiles_platform_read on public.profiles;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.platform_owners
    where auth_user_id=auth.uid() and active
  )
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create policy platform_owner_self_read on public.platform_owners
for select to authenticated using(auth_user_id=auth.uid());

create policy businesses_platform_read on public.businesses
for select to authenticated using(public.is_platform_owner());

create policy profiles_platform_read on public.profiles
for select to authenticated using(public.is_platform_owner());

insert into public.platform_owners(auth_user_id)
values('9cce2750-ff96-4c16-bc01-df86c03017e6')
on conflict(auth_user_id) do update set active=true;

update auth.users
set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||'{"platform_owner":true}'::jsonb
where id='9cce2750-ff96-4c16-bc01-df86c03017e6';

commit;
