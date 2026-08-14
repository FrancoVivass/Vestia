begin;

create or replace function public.adjust_inventory(p_variant uuid, p_owner uuid, p_counted integer, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_previous integer;
  v_delta integer;
  v_lot uuid;
  v_lot_row public.inventory_lots%rowtype;
  v_remaining integer;
  v_take integer;
begin
  if public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'Conteo inválido'; end if;
  if not exists(select 1 from public.product_variants where id = p_variant and business_id = v_business) then raise exception 'Variante inválida'; end if;
  if not exists(select 1 from public.owners where id = p_owner and business_id = v_business) then raise exception 'Dueño inválido'; end if;

  select quantity into v_previous from public.inventory_balances
  where business_id = v_business and variant_id = p_variant and owner_id = p_owner for update;
  if not found then
    v_previous := 0;
    insert into public.inventory_balances(business_id, variant_id, owner_id, quantity)
    values(v_business, p_variant, p_owner, 0);
  end if;

  v_delta := p_counted - v_previous;
  if v_delta = 0 then return; end if;

  if v_delta > 0 then
    insert into public.inventory_lots(business_id, variant_id, owner_id, unit_cost, initial_quantity, available_quantity, received_at)
    values(v_business, p_variant, p_owner, 0, v_delta, v_delta, now()) returning id into v_lot;
  else
    v_remaining := abs(v_delta);
    for v_lot_row in
      select * from public.inventory_lots
      where business_id = v_business and variant_id = p_variant and owner_id = p_owner and available_quantity > 0
      order by received_at, id for update
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_lot_row.available_quantity);
      update public.inventory_lots set available_quantity = available_quantity - v_take where id = v_lot_row.id;
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then raise exception 'Lotes insuficientes'; end if;
  end if;

  update public.inventory_balances set quantity = p_counted, updated_at = now()
  where business_id = v_business and variant_id = p_variant and owner_id = p_owner;
  insert into public.stock_movements(business_id, variant_id, owner_id, lot_id, quantity, movement_type,
    previous_stock, resulting_stock, performed_by, reference_type, notes)
  values(v_business, p_variant, p_owner, v_lot, v_delta,
    (case when v_delta > 0 then 'POSITIVE_ADJUSTMENT' else 'NEGATIVE_ADJUSTMENT' end)::public.stock_movement_type,
    v_previous, p_counted, public.current_profile_id(), 'PHYSICAL_INVENTORY', nullif(btrim(p_notes), ''));
end;
$$;

revoke all on function public.adjust_inventory(uuid,uuid,integer,text) from public;
grant execute on function public.adjust_inventory(uuid,uuid,integer,text) to authenticated;

commit;
