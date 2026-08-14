begin;

create or replace function public.save_product_complete(p_product_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_minimum integer := coalesce((p_data ->> 'minimum_stock')::integer, 0);
  v_maximum integer := coalesce((p_data ->> 'maximum_stock')::integer, 0);
  v_variant jsonb;
  v_variant_id uuid;
  v_owner uuid;
  v_lot uuid;
  v_quantity integer;
  v_previous integer;
begin
  if nullif(btrim(p_data ->> 'internal_code'), '') is null then
    raise exception 'El código interno es obligatorio';
  end if;
  if nullif(btrim(p_data ->> 'barcode'), '') is null then
    raise exception 'El código de barras general es obligatorio';
  end if;
  if v_maximum < 0 or (v_maximum > 0 and v_maximum < v_minimum) then
    raise exception 'El stock máximo debe ser cero o mayor o igual al stock mínimo';
  end if;

  v_product := public.save_product(p_product_id, p_data);
  update public.products
  set internal_code = btrim(p_data ->> 'internal_code'),
      barcode = btrim(p_data ->> 'barcode'),
      maximum_stock = v_maximum
  where id = v_product and business_id = v_business;

  for v_variant in select value from jsonb_array_elements(p_data -> 'variants')
  loop
      v_quantity := coalesce(nullif(v_variant ->> 'initial_stock', '')::integer, 0);
      if v_quantity < 0 then raise exception 'El stock inicial no puede ser negativo'; end if;
      if v_quantity = 0 then continue; end if;

      v_variant_id := nullif(v_variant ->> 'id', '')::uuid;
      if v_variant_id is null then
        select id into v_variant_id from public.product_variants
        where product_id=v_product and business_id=v_business and sku=btrim(v_variant ->> 'sku');
      end if;
      if v_variant_id is null then raise exception 'No se encontró la variante para cargar stock'; end if;

      v_owner := nullif(v_variant ->> 'owner_id', '')::uuid;
      if v_owner is not null and not exists(
        select 1 from public.owners where id=v_owner and business_id=v_business and active
      ) then raise exception 'El dueño seleccionado no pertenece al comercio'; end if;
      if v_owner is null then
        select id into v_owner from public.owners
        where business_id=v_business and active order by created_at,id limit 1;
      end if;
      if v_owner is null then
        insert into public.owners(business_id,first_name,last_name,participation_percentage,active)
        values(v_business,'Stock','Principal',100,true) returning id into v_owner;
      end if;

      select coalesce(quantity,0) into v_previous from public.inventory_balances
      where business_id=v_business and variant_id=v_variant_id and owner_id=v_owner for update;
      if not found then v_previous := 0; end if;

      insert into public.inventory_lots(business_id,variant_id,owner_id,unit_cost,initial_quantity,available_quantity,received_at,active)
      values(v_business,v_variant_id,v_owner,coalesce(nullif(v_variant ->> 'cost','')::numeric,0),v_quantity,v_quantity,now(),true)
      returning id into v_lot;

      insert into public.inventory_balances(business_id,variant_id,owner_id,quantity,updated_at)
      values(v_business,v_variant_id,v_owner,v_quantity,now())
      on conflict(business_id,variant_id,owner_id) do update
      set quantity=public.inventory_balances.quantity+excluded.quantity,updated_at=now();

      insert into public.stock_movements(
        business_id,variant_id,owner_id,lot_id,quantity,movement_type,previous_stock,resulting_stock,
        performed_by,reference_id,reference_type,notes
      ) values(
        v_business,v_variant_id,v_owner,v_lot,v_quantity,'POSITIVE_ADJUSTMENT',v_previous,v_previous+v_quantity,
        v_profile,v_product,'PRODUCT_STOCK_ENTRY',
        case when p_product_id is null then 'Stock inicial cargado al crear el producto' else 'Stock agregado desde la edición del producto' end
      );
  end loop;

  return v_product;
end;
$$;

revoke all on function public.save_product_complete(uuid,jsonb) from public;
grant execute on function public.save_product_complete(uuid,jsonb) to authenticated;

commit;
