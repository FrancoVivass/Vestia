begin;

create or replace function public.adjust_inventory(p_variant uuid,p_owner uuid,p_counted integer,p_notes text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_prev int;v_delta int;v_lot uuid;
begin
  if public.current_role()<>'OWNER' then raise exception 'Permiso denegado';end if;
  if p_counted<0 then raise exception 'Conteo inválido';end if;
  select quantity into v_prev from inventory_balances where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner for update;
  if not found then v_prev:=0;insert into inventory_balances values(public.current_business_id(),p_variant,p_owner,0,now());end if;
  v_delta:=p_counted-v_prev;
  if v_delta>0 then
    insert into inventory_lots(business_id,variant_id,owner_id,unit_cost,initial_quantity,available_quantity,received_at)
    values(public.current_business_id(),p_variant,p_owner,0,v_delta,v_delta,now()) returning id into v_lot;
  elsif v_delta<0 then
    if(select coalesce(sum(available_quantity),0)from inventory_lots where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner)<abs(v_delta)then raise exception 'Lotes insuficientes';end if;
    with consumed as(
      select id,available_quantity,sum(available_quantity)over(order by received_at,id)running
      from inventory_lots where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner and available_quantity>0 order by received_at,id for update
    )
    update inventory_lots l set available_quantity=greatest(0,l.available_quantity-greatest(0,least(l.available_quantity,abs(v_delta)-(c.running-c.available_quantity))))from consumed c where l.id=c.id;
  end if;
  update inventory_balances set quantity=p_counted,updated_at=now()where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner;
  insert into stock_movements(business_id,variant_id,owner_id,lot_id,quantity,movement_type,previous_stock,resulting_stock,performed_by,reference_type,notes)
  values(public.current_business_id(),p_variant,p_owner,v_lot,v_delta,(case when v_delta>=0 then 'POSITIVE_ADJUSTMENT' else 'NEGATIVE_ADJUSTMENT' end)::public.stock_movement_type,v_prev,p_counted,public.current_profile_id(),'PHYSICAL_INVENTORY',p_notes);
end $$;

revoke all on function public.adjust_inventory(uuid,uuid,integer,text) from public;
grant execute on function public.adjust_inventory(uuid,uuid,integer,text) to authenticated;

commit;
