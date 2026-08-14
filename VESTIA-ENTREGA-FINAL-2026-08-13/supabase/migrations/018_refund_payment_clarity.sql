begin;

alter table public.returns add column if not exists refund_payment_method_id uuid references public.payment_methods(id);

create or replace function public.register_return_with_method(
  p_sale uuid,
  p_allocations jsonb,
  p_reason text,
  p_refund numeric default 0,
  p_cash_session uuid default null,
  p_refund_method uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return uuid;
  v_business uuid := public.current_business_id();
  v_max_refund numeric(14,2);
begin
  select round(coalesce(sum((item.subtotal / nullif(item.quantity, 0)) * (entry.value ->> 'quantity')::integer), 0), 2)
  into v_max_refund
  from jsonb_array_elements(p_allocations) entry
  join public.sale_item_allocations allocation on allocation.id = (entry.value ->> 'allocation_id')::uuid
  join public.sale_items item on item.id = allocation.sale_item_id and item.sale_id = p_sale
  join public.sales sale on sale.id = item.sale_id and sale.business_id = v_business;

  if coalesce(p_refund, 0) > v_max_refund then
    raise exception 'El reintegro no puede superar el valor de los productos devueltos';
  end if;
  if coalesce(p_refund,0) > 0 then
    if p_refund_method is null then raise exception 'Seleccioná el tipo de pago del reintegro'; end if;
    if not exists(select 1 from public.payment_methods where id=p_refund_method and business_id=v_business and active) then
      raise exception 'Tipo de pago del reintegro inválido';
    end if;
  end if;
  v_return := public.register_return(p_sale,p_allocations,p_reason,p_refund,p_cash_session);
  update public.returns set refund_payment_method_id=case when p_refund>0 then p_refund_method else null end where id=v_return;
  if p_refund>0 then
    update public.cash_movements set payment_method_id=p_refund_method
    where business_id=v_business and reference_id=v_return and movement_type='REFUND';
  end if;
  return v_return;
end;
$$;

create or replace function public.register_exchange_with_method(
  p_original_sale uuid,
  p_allocations jsonb,
  p_reason text,
  p_cash_session uuid,
  p_new_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0,
  p_refund_method uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_difference numeric;
  v_return uuid;
  v_business uuid := public.current_business_id();
begin
  v_result := public.register_exchange(p_original_sale,p_allocations,p_reason,p_cash_session,p_new_items,p_payments,p_discount);
  v_difference := (v_result->>'difference')::numeric;
  v_return := (v_result->>'return_id')::uuid;
  if v_difference < 0 then
    if p_refund_method is null then raise exception 'Seleccioná el tipo de pago de la devolución de diferencia'; end if;
    if not exists(select 1 from public.payment_methods where id=p_refund_method and business_id=v_business and active) then
      raise exception 'Tipo de pago de la devolución inválido';
    end if;
    update public.returns set refund_payment_method_id=p_refund_method where id=v_return;
    update public.cash_movements set payment_method_id=p_refund_method
    where business_id=v_business and reference_id=v_return and movement_type='REFUND';
  end if;
  return v_result;
end;
$$;

revoke all on function public.register_return_with_method(uuid,jsonb,text,numeric,uuid,uuid),
  public.register_exchange_with_method(uuid,jsonb,text,uuid,jsonb,jsonb,numeric,uuid) from public;
grant execute on function public.register_return_with_method(uuid,jsonb,text,numeric,uuid,uuid),
  public.register_exchange_with_method(uuid,jsonb,text,uuid,jsonb,jsonb,numeric,uuid) to authenticated;

commit;
