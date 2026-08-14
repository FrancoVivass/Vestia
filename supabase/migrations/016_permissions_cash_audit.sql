begin;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles profile
    where profile.auth_user_id = auth.uid() and profile.active and (
      profile.role = 'OWNER'
      or (
        p_code in ('returns.create','exchanges.create')
        and profile.role = 'CASHIER'
        and coalesce((select settings.allow_cashier_returns from public.app_settings settings where settings.business_id = profile.business_id), false)
      )
      or coalesce(
        (select permission.enabled from public.profile_permissions permission where permission.profile_id = profile.id and permission.permission_code = p_code),
        (select role_permission.enabled from public.role_permissions role_permission where role_permission.role = profile.role and role_permission.permission_code = p_code),
        false
      )
    )
  )
$$;

create or replace function public.close_cash_register(p_session uuid, p_counted numeric, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected numeric(14,2);
  v_profile uuid := public.current_profile_id();
begin
  if p_counted is null or p_counted < 0 then raise exception 'Monto contado inválido'; end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('cash.close') then raise exception 'Permiso denegado'; end if;

  select session.opening_amount + coalesce((
    select sum(case
      when movement.movement_type = 'SALE' and method.code = 'CASH' then movement.amount
      when movement.movement_type in ('INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT') then movement.amount
      else 0 end)
    from public.cash_movements movement
    left join public.payment_methods method on method.id = movement.payment_method_id
    where movement.cash_session_id = session.id
  ), 0)
  into v_expected
  from public.cash_sessions session
  where session.id = p_session
    and session.business_id = public.current_business_id()
    and session.status = 'OPEN'
    and (session.opened_by = v_profile or public.current_role() = 'OWNER')
  for update;
  if not found then raise exception 'Caja inválida o abierta por otro usuario'; end if;

  update public.cash_sessions set
    status = 'CLOSED', closed_by = v_profile, expected_amount = v_expected,
    counted_amount = p_counted, difference = p_counted - v_expected,
    closed_at = now(), notes = nullif(btrim(p_notes), '')
  where id = p_session;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(public.current_business_id(), v_profile, 'CLOSE', 'CASH_SESSION', p_session,
    jsonb_build_object('expected_cash', v_expected, 'counted_cash', p_counted, 'difference', p_counted - v_expected));
end;
$$;

create or replace function public.cash_session_summary(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists(
    select 1 from public.cash_sessions session
    where session.id = p_session and session.business_id = public.current_business_id()
      and (session.opened_by = public.current_profile_id() or public.current_role() = 'OWNER')
  ) then raise exception 'Caja inválida'; end if;

  select jsonb_build_object(
    'opening', session.opening_amount,
    'expectedCash', session.opening_amount + coalesce(sum(case
      when movement.movement_type = 'SALE' and method.code = 'CASH' then movement.amount
      when movement.movement_type in ('INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT') then movement.amount
      else 0 end), 0),
    'sales', coalesce(sum(movement.amount) filter(where movement.movement_type = 'SALE'), 0),
    'income', coalesce(sum(movement.amount) filter(where movement.movement_type = 'INCOME'), 0),
    'expenses', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'EXPENSE'), 0)),
    'withdrawals', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'WITHDRAWAL'), 0)),
    'refunds', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'REFUND'), 0)),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('name', grouped.name, 'amount', grouped.amount) order by grouped.name)
      from (
        select coalesce(payment_method.name, 'Sin especificar') as name, sum(cash_movement.amount) as amount
        from public.cash_movements cash_movement
        left join public.payment_methods payment_method on payment_method.id = cash_movement.payment_method_id
        where cash_movement.cash_session_id = session.id and cash_movement.movement_type = 'SALE'
        group by coalesce(payment_method.name, 'Sin especificar')
      ) grouped
    ), '[]'::jsonb)
  ) into v_result
  from public.cash_sessions session
  left join public.cash_movements movement on movement.cash_session_id = session.id
  left join public.payment_methods method on method.id = movement.payment_method_id
  where session.id = p_session
  group by session.id, session.opening_amount;
  return v_result;
end;
$$;

create or replace function public.log_auth_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_business uuid := public.current_business_id();
begin
  if v_profile is null or upper(p_action) not in ('LOGIN','LOGOUT') then return; end if;
  if upper(p_action) = 'LOGIN' then update public.profiles set last_login_at = now() where id = v_profile; end if;
  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, upper(p_action), 'AUTH', v_profile);
end;
$$;

revoke all on function public.has_permission(text), public.close_cash_register(uuid,numeric,text),
  public.cash_session_summary(uuid), public.log_auth_event(text) from public;
grant execute on function public.has_permission(text), public.close_cash_register(uuid,numeric,text),
  public.cash_session_summary(uuid), public.log_auth_event(text) to authenticated;

commit;
