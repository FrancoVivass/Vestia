begin;

create or replace function public.register_exchange(
  p_original_sale uuid,
  p_allocations jsonb,
  p_reason text,
  p_cash_session uuid,
  p_new_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_credit numeric(14,2);
  v_new_total numeric(14,2) := 0;
  v_difference numeric(14,2);
  v_paid numeric(14,2);
  v_refund numeric(14,2);
  v_internal numeric(14,2);
  v_credit_method uuid;
  v_payments jsonb := coalesce(p_payments, '[]'::jsonb);
  v_return uuid;
  v_sale uuid;
  v_item jsonb;
begin
  if v_business is null or v_profile is null then
    raise exception 'No existe un comercio activo';
  end if;
  if public.current_role() <> 'OWNER' and not public.has_permission('exchanges.create') then
    raise exception 'Permiso denegado';
  end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'Seleccioná al menos un producto devuelto';
  end if;
  if jsonb_typeof(p_new_items) <> 'array' or jsonb_array_length(p_new_items) = 0 then
    raise exception 'Seleccioná al menos un producto nuevo';
  end if;

  select round(coalesce(sum((si.subtotal / nullif(si.quantity, 0)) * (entry.value ->> 'quantity')::integer), 0), 2)
  into v_credit
  from jsonb_array_elements(p_allocations) entry
  join public.sale_item_allocations allocation on allocation.id = (entry.value ->> 'allocation_id')::uuid
  join public.sale_items si on si.id = allocation.sale_item_id and si.sale_id = p_original_sale
  join public.sales sale on sale.id = si.sale_id and sale.business_id = v_business;

  if v_credit <= 0 then
    raise exception 'No hay crédito válido para el cambio';
  end if;

  for v_item in select value from jsonb_array_elements(p_new_items)
  loop
    if (v_item ->> 'quantity')::integer <= 0
      or (v_item ->> 'unit_price')::numeric < 0
      or coalesce((v_item ->> 'discount')::numeric, 0) < 0 then
      raise exception 'Los datos del nuevo producto son inválidos';
    end if;
    v_new_total := v_new_total
      + (v_item ->> 'quantity')::integer * (v_item ->> 'unit_price')::numeric
      - coalesce((v_item ->> 'discount')::numeric, 0);
  end loop;

  v_new_total := round(v_new_total - coalesce(p_discount, 0), 2);
  if v_new_total < 0 then raise exception 'El total del nuevo producto es inválido'; end if;

  v_difference := round(v_new_total - v_credit, 2);
  select round(coalesce(sum((entry.value ->> 'amount')::numeric), 0), 2)
  into v_paid
  from jsonb_array_elements(v_payments) entry;

  if v_paid <> greatest(v_difference, 0) then
    raise exception 'Los pagos deben coincidir con la diferencia: %', greatest(v_difference, 0);
  end if;

  v_refund := greatest(-v_difference, 0);
  v_internal := least(v_credit, v_new_total);
  v_return := public.register_return(p_original_sale, p_allocations, coalesce(nullif(btrim(p_reason), ''), 'Cambio'), v_refund, p_cash_session);

  insert into public.payment_methods(business_id, code, name, active)
  values(v_business, 'EXCHANGE_CREDIT', 'Crédito por cambio', false)
  on conflict(business_id, code) do update set name = excluded.name
  returning id into v_credit_method;

  if v_internal > 0 then
    v_payments := v_payments || jsonb_build_array(jsonb_build_object(
      'payment_method_id', v_credit_method,
      'amount', v_internal,
      'reference', 'Crédito de cambio'
    ));
  end if;

  v_sale := public.complete_sale(p_cash_session, null, p_new_items, v_payments, p_discount);

  -- El crédito interno queda documentado en la venta, pero no es dinero que ingresa a caja.
  delete from public.cash_movements
  where business_id = v_business
    and reference_id = v_sale
    and payment_method_id = v_credit_method;

  insert into public.exchanges(business_id, return_id, new_sale_id, difference, processed_by)
  values(v_business, v_return, v_sale, v_difference, v_profile);

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'CREATE', 'EXCHANGE', v_sale,
    jsonb_build_object('return_id', v_return, 'difference', v_difference));

  return jsonb_build_object(
    'return_id', v_return,
    'sale_id', v_sale,
    'credit', v_credit,
    'new_total', v_new_total,
    'difference', v_difference
  );
end;
$$;

revoke all on function public.register_exchange(uuid,jsonb,text,uuid,jsonb,jsonb,numeric) from public;
grant execute on function public.register_exchange(uuid,jsonb,text,uuid,jsonb,jsonb,numeric) to authenticated;

commit;
