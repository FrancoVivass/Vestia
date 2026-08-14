begin;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  cash_session_id uuid not null references public.cash_sessions(id),
  owner_id uuid references public.owners(id),
  payment_method_id uuid references public.payment_methods(id),
  category text not null,
  concept text not null,
  amount numeric(14,2) not null,
  occurred_at timestamptz not null default now(),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint expenses_amount_positive check(amount > 0),
  constraint expenses_category_not_blank check(btrim(category) <> ''),
  constraint expenses_concept_not_blank check(btrim(concept) <> '')
);

create index if not exists expenses_business_date_idx on public.expenses(business_id, occurred_at desc);
create index if not exists expenses_owner_date_idx on public.expenses(business_id, owner_id, occurred_at desc) where owner_id is not null;

alter table public.expenses enable row level security;
create policy expenses_owner_read on public.expenses for select to authenticated
  using(business_id = public.current_business_id() and public.current_role() = 'OWNER');
grant select on public.expenses to authenticated;

create or replace function public.register_expense(
  p_session uuid,
  p_concept text,
  p_category text,
  p_amount numeric,
  p_payment_method uuid default null,
  p_owner uuid default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_expense uuid;
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'El importe debe ser mayor que cero'; end if;
  if nullif(btrim(p_concept), '') is null or nullif(btrim(p_category), '') is null then raise exception 'Completá el concepto y la categoría'; end if;
  if not exists(select 1 from public.cash_sessions where id = p_session and business_id = v_business and status = 'OPEN') then raise exception 'No hay una caja abierta'; end if;
  if p_owner is not null and not exists(select 1 from public.owners where id = p_owner and business_id = v_business and active) then raise exception 'Dueño inválido'; end if;
  if p_payment_method is not null and not exists(select 1 from public.payment_methods where id = p_payment_method and business_id = v_business and active) then raise exception 'Tipo de pago inválido'; end if;

  insert into public.expenses(business_id, cash_session_id, owner_id, payment_method_id, category, concept, amount, occurred_at, notes, created_by)
  values(v_business, p_session, p_owner, p_payment_method, btrim(p_category), btrim(p_concept), round(p_amount, 2), coalesce(p_occurred_at, now()), nullif(btrim(p_notes), ''), v_profile)
  returning id into v_expense;

  insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, payment_method_id, reference_id, description, performed_by)
  values(v_business, p_session, 'EXPENSE', -round(p_amount, 2), p_payment_method, v_expense, btrim(p_concept), v_profile);

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'CREATE', 'EXPENSE', v_expense, jsonb_build_object('amount', round(p_amount, 2), 'owner_id', p_owner));
  return v_expense;
end;
$$;

create or replace function public.start_physical_inventory(p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_inventory uuid;
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if exists(select 1 from public.physical_inventories where business_id = v_business and status in ('DRAFT','IN_PROGRESS')) then
    raise exception 'Ya existe un inventario físico pendiente';
  end if;

  insert into public.physical_inventories(business_id, created_by, status, notes, started_at)
  values(v_business, v_profile, 'IN_PROGRESS', nullif(btrim(p_notes), ''), now()) returning id into v_inventory;

  insert into public.physical_inventory_items(inventory_id, variant_id, owner_id, expected_quantity)
  select v_inventory, balance.variant_id, balance.owner_id, balance.quantity
  from public.inventory_balances balance
  join public.product_variants variant on variant.id = balance.variant_id and variant.active
  join public.owners owner on owner.id = balance.owner_id and owner.active
  where balance.business_id = v_business;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, 'START', 'PHYSICAL_INVENTORY', v_inventory);
  return v_inventory;
end;
$$;

create or replace function public.set_physical_inventory_count(
  p_inventory uuid,
  p_variant uuid,
  p_owner uuid,
  p_counted integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'La cantidad contada es inválida'; end if;
  update public.physical_inventory_items item set counted_quantity = p_counted
  from public.physical_inventories inventory
  where item.inventory_id = inventory.id and inventory.id = p_inventory
    and inventory.business_id = public.current_business_id() and inventory.status = 'IN_PROGRESS'
    and item.variant_id = p_variant and item.owner_id = p_owner;
  if not found then raise exception 'Ítem de inventario inexistente'; end if;
end;
$$;

create or replace function public.complete_physical_inventory(p_inventory uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_item record;
  v_adjustments integer := 0;
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  perform 1 from public.physical_inventories
    where id = p_inventory and business_id = v_business and status = 'IN_PROGRESS' for update;
  if not found then raise exception 'Inventario físico inexistente o finalizado'; end if;
  if exists(select 1 from public.physical_inventory_items where inventory_id = p_inventory and counted_quantity is null) then
    raise exception 'Completá todas las cantidades contadas';
  end if;

  for v_item in
    select variant_id, owner_id, expected_quantity, counted_quantity
    from public.physical_inventory_items where inventory_id = p_inventory
  loop
    if v_item.expected_quantity <> v_item.counted_quantity then
      perform public.adjust_inventory(v_item.variant_id, v_item.owner_id, v_item.counted_quantity, 'Inventario físico ' || p_inventory::text);
      v_adjustments := v_adjustments + 1;
    end if;
  end loop;

  update public.physical_inventories set status = 'COMPLETED', completed_at = now() where id = p_inventory;
  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'COMPLETE', 'PHYSICAL_INVENTORY', p_inventory, jsonb_build_object('adjustments', v_adjustments));
  return v_adjustments;
end;
$$;

create or replace function public.cancel_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_sale public.sales%rowtype;
  v_allocation record;
  v_payment record;
  v_previous integer;
begin
  if v_business is null or v_profile is null or (public.current_role() <> 'OWNER' and not public.has_permission('sales.cancel')) then raise exception 'Permiso denegado'; end if;
  select * into v_sale from public.sales where id = p_sale and business_id = v_business for update;
  if not found then raise exception 'Venta inexistente'; end if;
  if v_sale.status <> 'COMPLETED' then raise exception 'Sólo se puede anular una venta completada sin devoluciones'; end if;
  if exists(select 1 from public.exchanges where new_sale_id = p_sale) then raise exception 'La venta pertenece a un cambio y no puede anularse por separado'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Indicá el motivo de la anulación'; end if;

  for v_allocation in
    select allocation.*, item.variant_id
    from public.sale_item_allocations allocation
    join public.sale_items item on item.id = allocation.sale_item_id
    where item.sale_id = p_sale
    order by allocation.id for update of allocation
  loop
    update public.inventory_lots set available_quantity = available_quantity + v_allocation.quantity where id = v_allocation.lot_id;
    select quantity into v_previous from public.inventory_balances
      where business_id = v_business and variant_id = v_allocation.variant_id and owner_id = v_allocation.owner_id for update;
    update public.inventory_balances set quantity = quantity + v_allocation.quantity, updated_at = now()
      where business_id = v_business and variant_id = v_allocation.variant_id and owner_id = v_allocation.owner_id;
    insert into public.stock_movements(business_id, variant_id, owner_id, lot_id, quantity, movement_type, previous_stock, resulting_stock, performed_by, reference_id, reference_type, notes)
    values(v_business, v_allocation.variant_id, v_allocation.owner_id, v_allocation.lot_id, v_allocation.quantity,
      'RETURN', v_previous, v_previous + v_allocation.quantity, v_profile, p_sale, 'SALE_CANCELLATION', btrim(p_reason));
  end loop;

  for v_payment in
    select movement.* from public.cash_movements movement
    where movement.business_id = v_business and movement.reference_id = p_sale and movement.movement_type = 'SALE'
  loop
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, payment_method_id, reference_id, description, performed_by)
    values(v_business, v_payment.cash_session_id, 'REFUND', -abs(v_payment.amount), v_payment.payment_method_id, p_sale, 'Anulación: ' || btrim(p_reason), v_profile);
  end loop;

  update public.sales set status = 'CANCELLED', updated_at = now() where id = p_sale;
  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'CANCEL', 'SALE', p_sale, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

create or replace function public.create_owner_settlement(p_owner uuid, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_gross numeric(14,2);
  v_cost numeric(14,2);
  v_expenses numeric(14,2);
  v_returns numeric(14,2);
  v_units integer;
  v_stock integer;
  v_profit numeric(14,2);
  v_id uuid;
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Período inválido'; end if;
  if not exists(select 1 from public.owners where id = p_owner and business_id = v_business) then raise exception 'Dueño inválido'; end if;

  select coalesce(sum(gross_sales),0), coalesce(sum(cost),0), coalesce(sum(units),0)
    into v_gross, v_cost, v_units
  from public.owner_sales_summary where business_id = v_business and owner_id = p_owner and sale_day::date between p_from and p_to;
  select coalesce(sum(amount),0) into v_expenses from public.expenses
    where business_id = v_business and owner_id = p_owner and occurred_at::date between p_from and p_to;
  select coalesce(sum(return_item.quantity * (sale_item.subtotal / nullif(sale_item.quantity,0))),0) into v_returns
  from public.return_items return_item
  join public.returns return_record on return_record.id = return_item.return_id and return_record.business_id = v_business
  join public.sale_item_allocations allocation on allocation.id = return_item.sale_item_allocation_id and allocation.owner_id = p_owner
  join public.sale_items sale_item on sale_item.id = allocation.sale_item_id
  where return_record.created_at::date between p_from and p_to;
  select coalesce(sum(quantity),0) into v_stock from public.inventory_balances where business_id = v_business and owner_id = p_owner;
  v_profit := round(v_gross - v_cost - v_expenses, 2);

  insert into public.owner_settlements(business_id, owner_id, date_from, date_to, gross_sales, cost, returns_amount, expenses, net_amount, created_by)
  values(v_business, p_owner, p_from, p_to, v_gross, v_cost, v_returns, v_expenses, v_profit, v_profile)
  returning id into v_id;
  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, 'CREATE', 'OWNER_SETTLEMENT', v_id);

  return jsonb_build_object('id',v_id,'gross',v_gross,'cost',v_cost,'expenses',v_expenses,'returns',v_returns,'profit',v_profit,'units',v_units,'stock',v_stock);
end;
$$;

create or replace function public.update_business_identity(
  p_name text,
  p_address text,
  p_phone text,
  p_email text,
  p_currency text,
  p_logo_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'El nombre del comercio es obligatorio'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'La moneda debe tener un código de tres letras'; end if;
  update public.businesses set name=btrim(p_name),address=nullif(btrim(p_address),''),phone=nullif(btrim(p_phone),''),
    email=nullif(lower(btrim(p_email)),''),currency=upper(p_currency),logo_path=nullif(p_logo_path,''),updated_at=now()
  where id=public.current_business_id();
  insert into public.audit_logs(business_id,actor_profile_id,action,entity_type,entity_id)
  values(public.current_business_id(),public.current_profile_id(),'UPDATE','BUSINESS',public.current_business_id());
end;
$$;

create or replace function public.enforce_cashier_sale_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_price numeric(14,2);
begin
  if public.current_role() = 'CASHIER' then
    select price into v_price from public.product_variants where id = new.variant_id and business_id = public.current_business_id();
    if new.unit_price <> v_price or new.discount <> 0 then raise exception 'El cajero no puede modificar precios ni descuentos'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sale_items_cashier_values on public.sale_items;
create trigger sale_items_cashier_values before insert or update on public.sale_items
for each row execute function public.enforce_cashier_sale_values();

create or replace function public.enforce_cashier_sale_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() = 'CASHIER' and new.discount <> 0 then raise exception 'El cajero no puede aplicar descuentos generales'; end if;
  return new;
end;
$$;

drop trigger if exists sales_cashier_discount on public.sales;
create trigger sales_cashier_discount before insert or update of discount on public.sales
for each row execute function public.enforce_cashier_sale_discount();

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
  select session.opening_amount + coalesce((select sum(case
    when movement.movement_type = 'SALE' and method.code = 'CASH' then movement.amount
    when movement.movement_type in ('INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT')
      and (movement.payment_method_id is null or method.code = 'CASH') then movement.amount
    else 0 end)
    from public.cash_movements movement left join public.payment_methods method on method.id = movement.payment_method_id
    where movement.cash_session_id = session.id),0)
  into v_expected from public.cash_sessions session
  where session.id = p_session and session.business_id = public.current_business_id() and session.status = 'OPEN'
    and (session.opened_by = v_profile or public.current_role() = 'OWNER') for update;
  if not found then raise exception 'Caja inválida o abierta por otro usuario'; end if;
  update public.cash_sessions set status='CLOSED',closed_by=v_profile,expected_amount=v_expected,counted_amount=p_counted,
    difference=p_counted-v_expected,closed_at=now(),notes=nullif(btrim(p_notes),'') where id=p_session;
  insert into public.audit_logs(business_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(public.current_business_id(),v_profile,'CLOSE','CASH_SESSION',p_session,jsonb_build_object('expected_cash',v_expected,'counted_cash',p_counted,'difference',p_counted-v_expected));
end;
$$;

create or replace function public.cash_session_summary(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.cash_sessions where id=p_session and business_id=public.current_business_id()
    and (opened_by=public.current_profile_id() or public.current_role()='OWNER')) then raise exception 'Caja inválida'; end if;
  select jsonb_build_object(
    'opening',session.opening_amount,
    'expectedCash',session.opening_amount+coalesce(sum(case
      when movement.movement_type='SALE' and method.code='CASH' then movement.amount
      when movement.movement_type in('INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT')
        and (movement.payment_method_id is null or method.code='CASH') then movement.amount else 0 end),0),
    'sales',coalesce(sum(movement.amount) filter(where movement.movement_type='SALE'),0),
    'income',coalesce(sum(movement.amount) filter(where movement.movement_type='INCOME'),0),
    'expenses',abs(coalesce(sum(movement.amount) filter(where movement.movement_type='EXPENSE'),0)),
    'withdrawals',abs(coalesce(sum(movement.amount) filter(where movement.movement_type='WITHDRAWAL'),0)),
    'refunds',abs(coalesce(sum(movement.amount) filter(where movement.movement_type='REFUND'),0)),
    'payments',coalesce((select jsonb_agg(jsonb_build_object('name',grouped.name,'amount',grouped.amount) order by grouped.name)
      from(select coalesce(pm.name,'Sin especificar') name,sum(cm.amount) amount from public.cash_movements cm
        left join public.payment_methods pm on pm.id=cm.payment_method_id where cm.cash_session_id=session.id and cm.movement_type='SALE'
        group by coalesce(pm.name,'Sin especificar'))grouped),'[]'::jsonb)
  ) into v_result
  from public.cash_sessions session left join public.cash_movements movement on movement.cash_session_id=session.id
  left join public.payment_methods method on method.id=movement.payment_method_id where session.id=p_session
  group by session.id,session.opening_amount;
  return v_result;
end;
$$;

create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := coalesce((to_jsonb(new)->>'business_id')::uuid,(to_jsonb(old)->>'business_id')::uuid);
  v_id uuid := coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid);
begin
  insert into public.audit_logs(business_id,actor_profile_id,action,entity_type,entity_id,old_data,new_data)
  values(v_business,public.current_profile_id(),tg_op,upper(tg_table_name),v_id,
    case when tg_op in('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in('INSERT','UPDATE') then to_jsonb(new) end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array['owners','suppliers','customers','categories','brands','sizes','colors','payment_methods','cash_registers']
  loop
    execute format('drop trigger if exists audit_business_change_trigger on public.%I',v_table);
    execute format('create trigger audit_business_change_trigger after insert or update or delete on public.%I for each row execute function public.audit_business_change()',v_table);
  end loop;
end;
$$;

revoke all on function public.register_expense(uuid,text,text,numeric,uuid,uuid,text,timestamptz),
  public.start_physical_inventory(text), public.set_physical_inventory_count(uuid,uuid,uuid,integer),
  public.complete_physical_inventory(uuid), public.cancel_sale(uuid,text), public.create_owner_settlement(uuid,date,date),
  public.update_business_identity(text,text,text,text,text,text) from public;
grant execute on function public.register_expense(uuid,text,text,numeric,uuid,uuid,text,timestamptz),
  public.start_physical_inventory(text), public.set_physical_inventory_count(uuid,uuid,uuid,integer),
  public.complete_physical_inventory(uuid), public.cancel_sale(uuid,text), public.create_owner_settlement(uuid,date,date),
  public.update_business_identity(text,text,text,text,text,text) to authenticated;

commit;
