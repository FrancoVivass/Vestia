begin;

set local role service_role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.platform_owners;
  perform id from public.businesses limit 1;
  perform id from public.profiles limit 1;
  if v_count < 1 then raise exception 'No existe el propietario de plataforma'; end if;
end;
$$;

rollback;
