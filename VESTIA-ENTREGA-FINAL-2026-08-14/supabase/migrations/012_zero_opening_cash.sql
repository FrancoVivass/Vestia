begin;

create or replace function public.open_cash_register(p_register_id uuid, p_opening numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_business uuid := public.current_business_id();
  v_id uuid;
begin
  if v_profile is null or v_business is null then raise exception 'No existe un comercio activo'; end if;
  if p_opening is null or p_opening < 0 then raise exception 'Monto de apertura inválido'; end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('cash.open') then raise exception 'Permiso denegado'; end if;

  insert into public.cash_sessions(business_id, cash_register_id, opened_by, opening_amount)
  select v_business, register.id, v_profile, p_opening
  from public.cash_registers register
  where register.id = p_register_id and register.business_id = v_business and register.active
  returning id into v_id;
  if v_id is null then raise exception 'Caja inexistente o inactiva'; end if;

  if p_opening > 0 then
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, description, performed_by)
    values(v_business, v_id, 'OPENING', p_opening, 'Apertura de caja', v_profile);
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'La caja ya se encuentra abierta';
end;
$$;

revoke all on function public.open_cash_register(uuid,numeric) from public;
grant execute on function public.open_cash_register(uuid,numeric) to authenticated;

commit;
