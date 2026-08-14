-- VESTIA — BASE DE DATOS COMPLETA
-- Generada desde las migraciones verificadas 001 a 021 el 14/08/2026.
-- Destino: un proyecto Supabase nuevo. En el proyecto vinculado actual ya está aplicada.
-- Antes de ejecutar, el usuario de plataforma configurado en 006 debe existir en Auth.

-- ============================================================================
-- 001_initial_schema.sql
-- ============================================================================
begin;

create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('OWNER','CASHIER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.record_status as enum ('ACTIVE','INACTIVE'); exception when duplicate_object then null; end $$;
do $$ begin create type public.sale_status as enum ('COMPLETED','CANCELLED','RETURNED','PARTIALLY_RETURNED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.purchase_status as enum ('DRAFT','CONFIRMED','CANCELLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cash_session_status as enum ('OPEN','CLOSED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_movement_type as enum ('PURCHASE_ENTRY','SALE','RETURN','EXCHANGE','POSITIVE_ADJUSTMENT','NEGATIVE_ADJUSTMENT','LOSS','DAMAGED_PRODUCT','TRANSFER'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cash_movement_type as enum ('OPENING','SALE','INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inventory_status as enum ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED'); exception when duplicate_object then null; end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(), name text not null, legal_name text, tax_id text,
  email text, phone text, address text, logo_path text, currency char(3) not null default 'ARS',
  timezone text not null default 'America/Argentina/Buenos_Aires', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint businesses_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  first_name text not null, last_name text not null, document text, phone text, email text, address text,
  participation_percentage numeric(5,2), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint owners_participation_range check (participation_percentage is null or participation_percentage between 0 and 100)
);
create unique index if not exists owners_document_unique on public.owners(business_id, document) where document is not null;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id), owner_id uuid references public.owners(id),
  first_name text not null, last_name text not null, email text not null, phone text, avatar_path text,
  role public.user_role not null, active boolean not null default true, last_login_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists public.permissions (
  code text primary key, name text not null, description text, module text not null
);
create table if not exists public.role_permissions (
  role public.user_role not null, permission_code text not null references public.permissions(code) on delete cascade,
  enabled boolean not null default true, primary key(role, permission_code)
);
create table if not exists public.profile_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  enabled boolean not null, primary key(profile_id, permission_code)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, description text, image_path text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id, name)
);
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, description text, logo_path text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id, name)
);
create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id, name)
);
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, hex_code varchar(7), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id, name), constraint colors_hex_format check (hex_code is null or hex_code ~ '^#[0-9A-Fa-f]{6}$')
);
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, legal_name text, tax_id text, phone text, email text, address text, contact_name text, notes text,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_tax_id_unique on public.suppliers(business_id, tax_id) where tax_id is not null;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  sku text not null, name text not null, description text, category_id uuid references public.categories(id),
  brand_id uuid references public.brands(id), default_supplier_id uuid references public.suppliers(id), main_image_path text,
  base_cost numeric(14,2), base_price numeric(14,2) not null, promotional_price numeric(14,2), minimum_stock integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id, sku), constraint products_prices_nonnegative check (base_price >= 0 and (base_cost is null or base_cost >= 0) and (promotional_price is null or promotional_price >= 0)),
  constraint products_min_stock_nonnegative check (minimum_stock >= 0)
);
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  product_id uuid not null references public.products(id), size_id uuid references public.sizes(id), color_id uuid references public.colors(id),
  sku text not null, barcode text not null, cost numeric(14,2), price numeric(14,2) not null, minimum_stock integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id, sku), unique(business_id, barcode), unique(product_id, size_id, color_id),
  constraint variants_prices_nonnegative check (price >= 0 and (cost is null or cost >= 0)), constraint variants_min_stock_nonnegative check (minimum_stock >= 0)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  first_name text not null, last_name text, document text, phone text, email text, address text, notes text,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists customers_document_unique on public.customers(business_id, document) where document is not null;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  supplier_id uuid references public.suppliers(id), owner_id uuid not null references public.owners(id), created_by uuid not null references public.profiles(id),
  receipt_number text, purchased_at timestamptz not null default now(), subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  status public.purchase_status not null default 'DRAFT', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint purchases_amounts_nonnegative check (subtotal >= 0 and discount >= 0 and tax >= 0 and total >= 0)
);
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(), purchase_id uuid not null references public.purchases(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id), quantity integer not null, unit_cost numeric(14,2) not null,
  discount numeric(14,2) not null default 0, subtotal numeric(14,2) generated always as ((quantity * unit_cost) - discount) stored,
  constraint purchase_items_quantity_positive check (quantity > 0), constraint purchase_items_amounts_nonnegative check (unit_cost >= 0 and discount >= 0)
);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  variant_id uuid not null references public.product_variants(id), owner_id uuid not null references public.owners(id),
  purchase_item_id uuid references public.purchase_items(id), unit_cost numeric(14,2) not null,
  initial_quantity integer not null, available_quantity integer not null, received_at timestamptz not null default now(),
  active boolean not null default true, created_at timestamptz not null default now(),
  constraint lots_quantities_valid check (initial_quantity > 0 and available_quantity between 0 and initial_quantity), constraint lots_cost_nonnegative check(unit_cost >= 0)
);
create table if not exists public.inventory_balances (
  business_id uuid not null references public.businesses(id), variant_id uuid not null references public.product_variants(id),
  owner_id uuid not null references public.owners(id), quantity integer not null default 0,
  updated_at timestamptz not null default now(), primary key(business_id, variant_id, owner_id), constraint balances_nonnegative check(quantity >= 0)
);
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  variant_id uuid not null references public.product_variants(id), owner_id uuid not null references public.owners(id),
  lot_id uuid references public.inventory_lots(id), quantity integer not null, movement_type public.stock_movement_type not null,
  previous_stock integer not null, resulting_stock integer not null, performed_by uuid not null references public.profiles(id),
  reference_id uuid, reference_type text, notes text, created_at timestamptz not null default now(),
  constraint movements_quantity_nonzero check(quantity <> 0), constraint movements_stock_nonnegative check(previous_stock >= 0 and resulting_stock >= 0)
);

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  name text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(business_id, name)
);
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  cash_register_id uuid not null references public.cash_registers(id), opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id), status public.cash_session_status not null default 'OPEN', opening_amount numeric(14,2) not null,
  expected_amount numeric(14,2), counted_amount numeric(14,2), difference numeric(14,2), opened_at timestamptz not null default now(), closed_at timestamptz,
  notes text, constraint cash_opening_nonnegative check(opening_amount >= 0)
);
create unique index if not exists one_open_cash_session_per_register on public.cash_sessions(cash_register_id) where status='OPEN';

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  sale_number bigint generated always as identity, cashier_id uuid not null references public.profiles(id), customer_id uuid references public.customers(id),
  cash_session_id uuid not null references public.cash_sessions(id), subtotal numeric(14,2) not null, discount numeric(14,2) not null default 0,
  total numeric(14,2) not null, status public.sale_status not null default 'COMPLETED', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(business_id, sale_number), constraint sales_amounts_nonnegative check(subtotal >= 0 and discount >= 0 and total >= 0)
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id), variant_id uuid not null references public.product_variants(id),
  quantity integer not null, unit_price numeric(14,2) not null, discount numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null, constraint sale_items_quantity_positive check(quantity > 0),
  constraint sale_items_amounts_nonnegative check(unit_price >= 0 and discount >= 0 and subtotal >= 0)
);
create table if not exists public.sale_item_allocations (
  id uuid primary key default gen_random_uuid(), sale_item_id uuid not null references public.sale_items(id),
  owner_id uuid not null references public.owners(id), lot_id uuid not null references public.inventory_lots(id), quantity integer not null,
  unit_cost numeric(14,2) not null, constraint allocation_quantity_positive check(quantity > 0), constraint allocation_cost_nonnegative check(unit_cost >= 0)
);
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  code text not null, name text not null, requires_reference boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), unique(business_id, code)
);
create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id),
  payment_method_id uuid not null references public.payment_methods(id), amount numeric(14,2) not null, external_reference text,
  created_at timestamptz not null default now(), constraint payment_amount_positive check(amount > 0)
);
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), cash_session_id uuid not null references public.cash_sessions(id),
  movement_type public.cash_movement_type not null, amount numeric(14,2) not null, payment_method_id uuid references public.payment_methods(id),
  reference_id uuid, description text, performed_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  constraint cash_movement_amount_nonzero check(amount <> 0)
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), original_sale_id uuid not null references public.sales(id),
  cash_session_id uuid references public.cash_sessions(id), processed_by uuid not null references public.profiles(id), reason text not null,
  refund_amount numeric(14,2) not null default 0, created_at timestamptz not null default now(), constraint return_refund_nonnegative check(refund_amount >= 0)
);
create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(), return_id uuid not null references public.returns(id),
  sale_item_allocation_id uuid not null references public.sale_item_allocations(id), quantity integer not null,
  condition text, constraint return_item_quantity_positive check(quantity > 0)
);
create table if not exists public.exchanges (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), return_id uuid not null references public.returns(id),
  new_sale_id uuid not null references public.sales(id), difference numeric(14,2) not null default 0, processed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.physical_inventories (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), created_by uuid not null references public.profiles(id),
  status public.inventory_status not null default 'DRAFT', notes text, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.physical_inventory_items (
  id uuid primary key default gen_random_uuid(), inventory_id uuid not null references public.physical_inventories(id),
  variant_id uuid not null references public.product_variants(id), owner_id uuid not null references public.owners(id),
  expected_quantity integer not null, counted_quantity integer, unique(inventory_id, variant_id, owner_id),
  constraint inventory_counts_nonnegative check(expected_quantity >= 0 and (counted_quantity is null or counted_quantity >= 0))
);

create table if not exists public.owner_settlements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), owner_id uuid not null references public.owners(id),
  date_from date not null, date_to date not null, gross_sales numeric(14,2) not null, cost numeric(14,2) not null,
  returns_amount numeric(14,2) not null default 0, expenses numeric(14,2) not null default 0, net_amount numeric(14,2) not null,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), constraint settlement_dates_valid check(date_to >= date_from)
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key, business_id uuid not null references public.businesses(id), actor_profile_id uuid references public.profiles(id),
  action text not null, entity_type text not null, entity_id uuid, old_data jsonb, new_data jsonb, metadata jsonb not null default '{}'::jsonb,
  ip_address inet, created_at timestamptz not null default now()
);
create table if not exists public.app_settings (
  business_id uuid primary key references public.businesses(id), store_name text not null, logo_path text, address text, phone text, email text,
  currency char(3) not null default 'ARS', tax_rate numeric(5,2) not null default 0, default_minimum_stock integer not null default 0,
  allow_cashier_returns boolean not null default false, allow_pending_balance boolean not null default false,
  label_settings jsonb not null default '{}', ticket_settings jsonb not null default '{}', theme_settings jsonb not null default '{}', updated_at timestamptz not null default now()
);

create index if not exists profiles_business_idx on public.profiles(business_id, active);
create index if not exists products_search_idx on public.products(business_id, active, name);
create index if not exists variants_product_idx on public.product_variants(product_id, active);
create index if not exists lots_available_fifo_idx on public.inventory_lots(business_id, variant_id, owner_id, received_at) where available_quantity > 0 and active;
create index if not exists stock_movements_variant_date_idx on public.stock_movements(business_id, variant_id, created_at desc);
create index if not exists purchases_date_idx on public.purchases(business_id, purchased_at desc);
create index if not exists sales_date_status_idx on public.sales(business_id, created_at desc, status);
create index if not exists sales_cashier_date_idx on public.sales(cashier_id, created_at desc);
create index if not exists audit_entity_idx on public.audit_logs(business_id, entity_type, entity_id, created_at desc);

commit;

-- ============================================================================
-- 002_security_rls.sql
-- ============================================================================
begin;

do $$ declare p record; begin
  for p in select * from (values
    ('businesses','businesses_read'),('profiles','profiles_read'),('profiles','profiles_owner_write'),
    ('permissions','permissions_read'),('role_permissions','role_permissions_read'),('profile_permissions','profile_permissions_owner'),
    ('product_images','product_images_read'),('product_images','product_images_write'),
    ('inventory_balances','inventory_balances_cashier_read'),('sales','sales_read'),('cash_sessions','cash_sessions_read'),
    ('cash_movements','cash_movements_read'),('returns','returns_read'),('exchanges','exchanges_read'),
    ('purchase_items','purchase_items_owner_read'),('sale_items','sale_items_read'),
    ('sale_item_allocations','allocations_read'),('sale_payments','payments_read'),
    ('return_items','return_items_read'),('physical_inventory_items','inventory_items_owner')
  ) as x(tab,pol) loop execute format('drop policy if exists %I on public.%I',p.pol,p.tab); end loop;
  for p in select unnest(array['owners','categories','brands','sizes','colors','suppliers','products','product_variants','customers','payment_methods','cash_registers','app_settings']) tab
    loop execute format('drop policy if exists %I on public.%I',p.tab||'_read',p.tab);execute format('drop policy if exists %I on public.%I',p.tab||'_owner_write',p.tab);end loop;
  for p in select unnest(array['purchases','inventory_lots','inventory_balances','stock_movements','physical_inventories','owner_settlements','audit_logs']) tab
    loop execute format('drop policy if exists %I on public.%I',p.tab||'_owner_read',p.tab);end loop;
end $$;

create or replace function public.current_profile_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.current_business_id() returns uuid language sql stable security definer set search_path=public as $$
  select business_id from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.current_role() returns public.user_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where auth_user_id=auth.uid() and active limit 1
$$;
create or replace function public.has_permission(p_code text) returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id=auth.uid() and p.active and (
      p.role='OWNER' or coalesce((select pp.enabled from public.profile_permissions pp where pp.profile_id=p.id and pp.permission_code=p_code),
      (select rp.enabled from public.role_permissions rp where rp.role=p.role and rp.permission_code=p_code), false)
    )
  )
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_business_id() from public;
revoke all on function public.current_role() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_profile_id(), public.current_business_id(), public.current_role(), public.has_permission(text) to authenticated;

do $$ declare t text; begin
  foreach t in array array['businesses','owners','profiles','permissions','role_permissions','profile_permissions','categories','brands','sizes','colors','suppliers','products','product_images','product_variants','customers','purchases','purchase_items','inventory_lots','inventory_balances','stock_movements','cash_registers','cash_sessions','sales','sale_items','sale_item_allocations','payment_methods','sale_payments','cash_movements','returns','return_items','exchanges','physical_inventories','physical_inventory_items','owner_settlements','audit_logs','app_settings']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy businesses_read on public.businesses for select to authenticated using(id=public.current_business_id());
create policy profiles_read on public.profiles for select to authenticated using(business_id=public.current_business_id());
create policy profiles_owner_write on public.profiles for all to authenticated using(business_id=public.current_business_id() and public.current_role()='OWNER') with check(business_id=public.current_business_id() and public.current_role()='OWNER');
create policy permissions_read on public.permissions for select to authenticated using(true);
create policy role_permissions_read on public.role_permissions for select to authenticated using(true);
create policy profile_permissions_owner on public.profile_permissions for all to authenticated using(public.current_role()='OWNER') with check(public.current_role()='OWNER');

do $$ declare t text; begin
  foreach t in array array['owners','categories','brands','sizes','colors','suppliers','products','product_variants','customers','payment_methods','cash_registers','app_settings']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (business_id=public.current_business_id())', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (business_id=public.current_business_id() and public.current_role()=''OWNER'') with check (business_id=public.current_business_id() and public.current_role()=''OWNER'')', t||'_owner_write', t);
  end loop;
end $$;

create policy product_images_read on public.product_images for select to authenticated using(exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id()));
create policy product_images_write on public.product_images for all to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id())) with check(public.current_role()='OWNER' and exists(select 1 from public.products p where p.id=product_id and p.business_id=public.current_business_id()));

do $$ declare t text; begin
  foreach t in array array['purchases','inventory_lots','inventory_balances','stock_movements','physical_inventories','owner_settlements','audit_logs']
  loop execute format('create policy %I on public.%I for select to authenticated using (business_id=public.current_business_id() and public.current_role()=''OWNER'')', t||'_owner_read',t); end loop;
end $$;
create policy inventory_balances_cashier_read on public.inventory_balances for select to authenticated using(business_id=public.current_business_id() and public.has_permission('stock.read'));
create policy sales_read on public.sales for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or cashier_id=public.current_profile_id()));
create policy cash_sessions_read on public.cash_sessions for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or opened_by=public.current_profile_id()));
create policy cash_movements_read on public.cash_movements for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or performed_by=public.current_profile_id()));
create policy returns_read on public.returns for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or processed_by=public.current_profile_id()));
create policy exchanges_read on public.exchanges for select to authenticated using(business_id=public.current_business_id() and (public.current_role()='OWNER' or processed_by=public.current_profile_id()));

create policy purchase_items_owner_read on public.purchase_items for select to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id()));
create policy sale_items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy allocations_read on public.sale_item_allocations for select to authenticated using(exists(select 1 from public.sale_items si join public.sales s on s.id=si.sale_id where si.id=sale_item_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy payments_read on public.sale_payments for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id and s.business_id=public.current_business_id() and (public.current_role()='OWNER' or s.cashier_id=public.current_profile_id())));
create policy return_items_read on public.return_items for select to authenticated using(exists(select 1 from public.returns r where r.id=return_id and r.business_id=public.current_business_id() and (public.current_role()='OWNER' or r.processed_by=public.current_profile_id())));
create policy inventory_items_owner on public.physical_inventory_items for select to authenticated using(public.current_role()='OWNER' and exists(select 1 from public.physical_inventories i where i.id=inventory_id and i.business_id=public.current_business_id()));

commit;

-- ============================================================================
-- 003_functions.sql
-- ============================================================================
begin;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['businesses','owners','profiles','categories','brands','sizes','colors','suppliers','products','product_variants','customers','purchases','sales'] loop execute format('drop trigger if exists %I on public.%I',t||'_touch',t);execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',t||'_touch',t);end loop;end $$;

create or replace function public.open_cash_register(p_register_id uuid,p_opening numeric) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid:=public.current_profile_id(); v_business uuid:=public.current_business_id(); v_id uuid;
begin if v_profile is null or p_opening<0 then raise exception 'Datos de apertura inválidos'; end if;
insert into cash_sessions(business_id,cash_register_id,opened_by,opening_amount) select v_business,id,v_profile,p_opening from cash_registers where id=p_register_id and business_id=v_business and active returning id into v_id;
if v_id is null then raise exception 'Caja inexistente'; end if;
insert into cash_movements(business_id,cash_session_id,movement_type,amount,description,performed_by) values(v_business,v_id,'OPENING',p_opening,'Apertura de caja',v_profile); return v_id; end $$;

create or replace function public.confirm_purchase(p_purchase_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_p purchases%rowtype; v_i purchase_items%rowtype; v_lot uuid; v_prev int;
begin if public.current_role()<>'OWNER' then raise exception 'Permiso denegado'; end if;
select * into v_p from purchases where id=p_purchase_id and business_id=public.current_business_id() and status='DRAFT' for update;
if not found then raise exception 'Compra no disponible'; end if;
for v_i in select * from purchase_items where purchase_id=v_p.id loop
 insert into inventory_lots(business_id,variant_id,owner_id,purchase_item_id,unit_cost,initial_quantity,available_quantity,received_at) values(v_p.business_id,v_i.variant_id,v_p.owner_id,v_i.id,v_i.unit_cost,v_i.quantity,v_i.quantity,v_p.purchased_at) returning id into v_lot;
 insert into inventory_balances(business_id,variant_id,owner_id,quantity) values(v_p.business_id,v_i.variant_id,v_p.owner_id,v_i.quantity) on conflict(business_id,variant_id,owner_id) do update set quantity=inventory_balances.quantity+excluded.quantity,updated_at=now() returning quantity-v_i.quantity into v_prev;
 insert into stock_movements(business_id,variant_id,owner_id,lot_id,quantity,movement_type,previous_stock,resulting_stock,performed_by,reference_id,reference_type) values(v_p.business_id,v_i.variant_id,v_p.owner_id,v_lot,v_i.quantity,'PURCHASE_ENTRY',v_prev,v_prev+v_i.quantity,public.current_profile_id(),v_p.id,'PURCHASE');
end loop; update purchases set status='CONFIRMED' where id=v_p.id;
insert into audit_logs(business_id,actor_profile_id,action,entity_type,entity_id,new_data) values(v_p.business_id,public.current_profile_id(),'CONFIRM','PURCHASE',v_p.id,to_jsonb(v_p)); end $$;

create or replace function public.complete_sale(p_cash_session uuid,p_customer uuid,p_items jsonb,p_payments jsonb,p_discount numeric default 0) returns uuid language plpgsql security definer set search_path=public as $$
declare v_business uuid:=public.current_business_id(); v_profile uuid:=public.current_profile_id(); v_sale uuid; v_item jsonb; v_payment jsonb; v_si uuid; v_lot inventory_lots%rowtype; v_qty int; v_total numeric:=0; v_sub numeric; v_paid numeric; v_prev int;
begin if v_profile is null or not public.has_permission('sales.create') then raise exception 'Permiso denegado'; end if;
if not exists(select 1 from cash_sessions where id=p_cash_session and business_id=v_business and status='OPEN' and (opened_by=v_profile or public.current_role()='OWNER')) then raise exception 'Caja cerrada o inválida'; end if;
for v_item in select * from jsonb_array_elements(p_items) loop v_total:=v_total+((v_item->>'quantity')::int*(v_item->>'unit_price')::numeric-coalesce((v_item->>'discount')::numeric,0)); end loop;
v_total:=v_total-coalesce(p_discount,0); select coalesce(sum((x->>'amount')::numeric),0) into v_paid from jsonb_array_elements(p_payments) x; if v_total<0 or v_paid<>v_total then raise exception 'Los pagos no coinciden con el total'; end if;
insert into sales(business_id,cashier_id,customer_id,cash_session_id,subtotal,discount,total) values(v_business,v_profile,p_customer,p_cash_session,v_total+coalesce(p_discount,0),coalesce(p_discount,0),v_total) returning id into v_sale;
for v_item in select * from jsonb_array_elements(p_items) loop v_qty:=(v_item->>'quantity')::int; v_sub:=v_qty*(v_item->>'unit_price')::numeric-coalesce((v_item->>'discount')::numeric,0); insert into sale_items(sale_id,variant_id,quantity,unit_price,discount,subtotal) values(v_sale,(v_item->>'variant_id')::uuid,v_qty,(v_item->>'unit_price')::numeric,coalesce((v_item->>'discount')::numeric,0),v_sub) returning id into v_si;
 for v_lot in select * from inventory_lots where business_id=v_business and variant_id=(v_item->>'variant_id')::uuid and owner_id=(v_item->>'owner_id')::uuid and available_quantity>0 order by received_at,id for update loop exit when v_qty=0; v_prev:=least(v_qty,v_lot.available_quantity); update inventory_lots set available_quantity=available_quantity-v_prev where id=v_lot.id; insert into sale_item_allocations(sale_item_id,owner_id,lot_id,quantity,unit_cost) values(v_si,v_lot.owner_id,v_lot.id,v_prev,v_lot.unit_cost); v_qty:=v_qty-v_prev; end loop;
 if v_qty>0 then raise exception 'Stock insuficiente'; end if; select quantity into v_prev from inventory_balances where business_id=v_business and variant_id=(v_item->>'variant_id')::uuid and owner_id=(v_item->>'owner_id')::uuid for update; update inventory_balances set quantity=quantity-(v_item->>'quantity')::int,updated_at=now() where business_id=v_business and variant_id=(v_item->>'variant_id')::uuid and owner_id=(v_item->>'owner_id')::uuid; insert into stock_movements(business_id,variant_id,owner_id,quantity,movement_type,previous_stock,resulting_stock,performed_by,reference_id,reference_type) values(v_business,(v_item->>'variant_id')::uuid,(v_item->>'owner_id')::uuid,-(v_item->>'quantity')::int,'SALE',v_prev,v_prev-(v_item->>'quantity')::int,v_profile,v_sale,'SALE'); end loop;
for v_payment in select * from jsonb_array_elements(p_payments) loop insert into sale_payments(sale_id,payment_method_id,amount,external_reference) values(v_sale,(v_payment->>'payment_method_id')::uuid,(v_payment->>'amount')::numeric,v_payment->>'reference'); insert into cash_movements(business_id,cash_session_id,movement_type,amount,payment_method_id,reference_id,description,performed_by) values(v_business,p_cash_session,'SALE',(v_payment->>'amount')::numeric,(v_payment->>'payment_method_id')::uuid,v_sale,'Venta',v_profile); end loop;
insert into audit_logs(business_id,actor_profile_id,action,entity_type,entity_id) values(v_business,v_profile,'CREATE','SALE',v_sale); return v_sale; end $$;

create or replace function public.close_cash_register(p_session uuid,p_counted numeric,p_notes text default null) returns void language plpgsql security definer set search_path=public as $$ declare v_expected numeric; begin if p_counted<0 then raise exception 'Monto inválido'; end if; select opening_amount+coalesce((select sum(case when movement_type='OPENING' then 0 else amount end) from cash_movements where cash_session_id=p_session),0) into v_expected from cash_sessions where id=p_session and business_id=public.current_business_id() and status='OPEN' for update; if not found then raise exception 'Caja inválida'; end if; update cash_sessions set status='CLOSED',closed_by=public.current_profile_id(),expected_amount=v_expected,counted_amount=p_counted,difference=p_counted-v_expected,closed_at=now(),notes=p_notes where id=p_session; end $$;

revoke all on function public.open_cash_register(uuid,numeric),public.confirm_purchase(uuid),public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),public.close_cash_register(uuid,numeric,text) from public;
grant execute on function public.open_cash_register(uuid,numeric),public.confirm_purchase(uuid),public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),public.close_cash_register(uuid,numeric,text) to authenticated;
commit;

-- ============================================================================
-- 004_returns_reports.sql
-- ============================================================================
begin;
create or replace function public.register_return(p_sale uuid,p_allocations jsonb,p_reason text,p_refund numeric default 0,p_cash_session uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_business uuid:=public.current_business_id();v_profile uuid:=public.current_profile_id();v_return uuid;v_input jsonb;v_a sale_item_allocations%rowtype;v_si sale_items%rowtype;v_prev int;v_total_sold int;v_total_returned int;
begin if public.current_role()<>'OWNER' and not public.has_permission('returns.create') then raise exception 'Permiso denegado';end if;if p_refund<0 then raise exception 'Reintegro inválido';end if;if not exists(select 1 from sales where id=p_sale and business_id=v_business and status in('COMPLETED','PARTIALLY_RETURNED')) then raise exception 'Venta no disponible';end if;
insert into returns(business_id,original_sale_id,cash_session_id,processed_by,reason,refund_amount)values(v_business,p_sale,p_cash_session,v_profile,p_reason,p_refund)returning id into v_return;
for v_input in select * from jsonb_array_elements(p_allocations)loop select * into v_a from sale_item_allocations where id=(v_input->>'allocation_id')::uuid for update;select * into v_si from sale_items where id=v_a.sale_item_id and sale_id=p_sale;if not found or (v_input->>'quantity')::int<=0 or (v_input->>'quantity')::int>v_a.quantity-coalesce((select sum(ri.quantity) from return_items ri join returns r on r.id=ri.return_id where ri.sale_item_allocation_id=v_a.id),0) then raise exception 'Cantidad de devolución inválida';end if;
insert into return_items(return_id,sale_item_allocation_id,quantity,condition)values(v_return,v_a.id,(v_input->>'quantity')::int,v_input->>'condition');update inventory_lots set available_quantity=available_quantity+(v_input->>'quantity')::int where id=v_a.lot_id returning available_quantity-(v_input->>'quantity')::int into v_prev;select quantity into v_prev from inventory_balances where business_id=v_business and variant_id=v_si.variant_id and owner_id=v_a.owner_id for update;update inventory_balances set quantity=quantity+(v_input->>'quantity')::int,updated_at=now()where business_id=v_business and variant_id=v_si.variant_id and owner_id=v_a.owner_id;insert into stock_movements(business_id,variant_id,owner_id,lot_id,quantity,movement_type,previous_stock,resulting_stock,performed_by,reference_id,reference_type,notes)values(v_business,v_si.variant_id,v_a.owner_id,v_a.lot_id,(v_input->>'quantity')::int,'RETURN',v_prev,v_prev+(v_input->>'quantity')::int,v_profile,v_return,'RETURN',p_reason);end loop;
if p_refund>0 then if p_cash_session is null then raise exception 'Se requiere caja para reintegrar';end if;insert into cash_movements(business_id,cash_session_id,movement_type,amount,reference_id,description,performed_by)values(v_business,p_cash_session,'REFUND',-p_refund,v_return,'Devolución',v_profile);end if;
select sum(si.quantity),coalesce(sum(ri.quantity),0) into v_total_sold,v_total_returned from sale_items si left join sale_item_allocations a on a.sale_item_id=si.id left join return_items ri on ri.sale_item_allocation_id=a.id where si.sale_id=p_sale;update sales set status=case when v_total_returned>=v_total_sold then 'RETURNED'::sale_status else 'PARTIALLY_RETURNED'::sale_status end where id=p_sale;insert into audit_logs(business_id,actor_profile_id,action,entity_type,entity_id,metadata)values(v_business,v_profile,'CREATE','RETURN',v_return,jsonb_build_object('sale_id',p_sale));return v_return;end $$;

create or replace view public.owner_sales_summary with(security_invoker=true)as select s.business_id,a.owner_id,o.first_name owner_first_name,o.last_name owner_last_name,date_trunc('day',s.created_at) sale_day,sum(a.quantity*si.unit_price)gross_sales,sum(a.quantity*a.unit_cost)cost,sum(a.quantity*(si.unit_price-a.unit_cost))estimated_profit,sum(a.quantity)units from sales s join sale_items si on si.sale_id=s.id join sale_item_allocations a on a.sale_item_id=si.id join owners o on o.id=a.owner_id where s.status<>'CANCELLED' group by s.business_id,a.owner_id,o.first_name,o.last_name,date_trunc('day',s.created_at);
create or replace view public.dashboard_summary with(security_invoker=true)as select b.id business_id,coalesce((select sum(total)from sales where business_id=b.id and created_at>=current_date and status<>'CANCELLED'),0)today_sales,coalesce((select sum(total)from sales where business_id=b.id and created_at>=date_trunc('month',now())and status<>'CANCELLED'),0)month_sales,coalesce((select sum(quantity)from inventory_balances where business_id=b.id),0)total_stock,coalesce((select count(*)from inventory_balances ib join product_variants v on v.id=ib.variant_id where ib.business_id=b.id and ib.quantity<=v.minimum_stock),0)low_stock from businesses b;
revoke all on function public.register_return(uuid,jsonb,text,numeric,uuid)from public;grant execute on function public.register_return(uuid,jsonb,text,numeric,uuid)to authenticated;
commit;

-- ============================================================================
-- 005_inventory_cash_operations.sql
-- ============================================================================
begin;
create or replace function public.register_cash_movement(p_session uuid,p_type public.cash_movement_type,p_amount numeric,p_description text)returns uuid language plpgsql security definer set search_path=public as $$declare v_id uuid;begin if public.current_role()<>'OWNER'then raise exception'Permiso denegado';end if;if p_type not in('INCOME','EXPENSE','WITHDRAWAL')or p_amount<=0 then raise exception'Movimiento inválido';end if;if not exists(select 1 from cash_sessions where id=p_session and business_id=public.current_business_id()and status='OPEN')then raise exception'Caja cerrada';end if;insert into cash_movements(business_id,cash_session_id,movement_type,amount,description,performed_by)values(public.current_business_id(),p_session,p_type,case when p_type in('EXPENSE','WITHDRAWAL')then-p_amount else p_amount end,p_description,public.current_profile_id())returning id into v_id;return v_id;end$$;
create or replace function public.adjust_inventory(p_variant uuid,p_owner uuid,p_counted integer,p_notes text default null)returns void language plpgsql security definer set search_path=public as $$declare v_prev int;v_delta int;v_lot uuid;begin if public.current_role()<>'OWNER'then raise exception'Permiso denegado';end if;if p_counted<0 then raise exception'Conteo inválido';end if;select quantity into v_prev from inventory_balances where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner for update;if not found then v_prev:=0;insert into inventory_balances values(public.current_business_id(),p_variant,p_owner,0,now());end if;v_delta:=p_counted-v_prev;if v_delta>0 then insert into inventory_lots(business_id,variant_id,owner_id,unit_cost,initial_quantity,available_quantity,received_at)values(public.current_business_id(),p_variant,p_owner,0,v_delta,v_delta,now())returning id into v_lot;elsif v_delta<0 then if(select coalesce(sum(available_quantity),0)from inventory_lots where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner)<abs(v_delta)then raise exception'Lotes insuficientes';end if;with consumed as(select id,available_quantity,sum(available_quantity)over(order by received_at,id)running from inventory_lots where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner and available_quantity>0 order by received_at,id for update)update inventory_lots l set available_quantity=greatest(0,l.available_quantity-greatest(0,least(l.available_quantity,abs(v_delta)-(c.running-c.available_quantity))))from consumed c where l.id=c.id;end if;update inventory_balances set quantity=p_counted,updated_at=now()where business_id=public.current_business_id()and variant_id=p_variant and owner_id=p_owner;insert into stock_movements(business_id,variant_id,owner_id,lot_id,quantity,movement_type,previous_stock,resulting_stock,performed_by,reference_type,notes)values(public.current_business_id(),p_variant,p_owner,v_lot,v_delta,case when v_delta>=0 then'POSITIVE_ADJUSTMENT'else'NEGATIVE_ADJUSTMENT'end,v_prev,p_counted,public.current_profile_id(),'PHYSICAL_INVENTORY',p_notes);end$$;
revoke all on function public.register_cash_movement(uuid,public.cash_movement_type,numeric,text),public.adjust_inventory(uuid,uuid,integer,text)from public;grant execute on function public.register_cash_movement(uuid,public.cash_movement_type,numeric,text),public.adjust_inventory(uuid,uuid,integer,text)to authenticated;
commit;

-- ============================================================================
-- 006_platform_owner.sql
-- ============================================================================
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

-- ============================================================================
-- 007_api_access_and_storage.sql
-- ============================================================================
begin;

drop policy if exists purchases_owner_insert on public.purchases;
drop policy if exists purchases_owner_update on public.purchases;
drop policy if exists purchase_items_owner_write on public.purchase_items;
drop policy if exists customers_cashier_insert on public.customers;
drop policy if exists customers_cashier_update on public.customers;
drop policy if exists storage_business_read on storage.objects;
drop policy if exists storage_owner_insert on storage.objects;
drop policy if exists storage_owner_update on storage.objects;
drop policy if exists storage_owner_delete on storage.objects;

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant insert,update on public.owners,public.categories,public.brands,public.sizes,public.colors,
  public.suppliers,public.products,public.product_images,public.product_variants,public.customers,
  public.purchases,public.purchase_items,public.profiles,public.profile_permissions,
  public.payment_methods,public.cash_registers,public.app_settings to authenticated;

grant delete on public.profile_permissions,public.product_images to authenticated;

alter default privileges in schema public grant select on tables to authenticated;
alter default privileges in schema public grant usage,select on sequences to authenticated;

create policy purchases_owner_insert on public.purchases for insert to authenticated
with check(business_id=public.current_business_id() and public.current_role()='OWNER' and created_by=public.current_profile_id());

create policy purchases_owner_update on public.purchases for update to authenticated
using(business_id=public.current_business_id() and public.current_role()='OWNER' and status='DRAFT')
with check(business_id=public.current_business_id() and public.current_role()='OWNER');

create policy purchase_items_owner_write on public.purchase_items for all to authenticated
using(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id() and p.status='DRAFT'))
with check(public.current_role()='OWNER' and exists(select 1 from public.purchases p where p.id=purchase_id and p.business_id=public.current_business_id() and p.status='DRAFT'));

create policy customers_cashier_insert on public.customers for insert to authenticated
with check(business_id=public.current_business_id() and public.has_permission('customers.create'));

create policy customers_cashier_update on public.customers for update to authenticated
using(business_id=public.current_business_id() and public.has_permission('customers.create'))
with check(business_id=public.current_business_id() and public.has_permission('customers.create'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('business-assets','business-assets',false,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('product-images','product-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_business_read on storage.objects for select to authenticated
using(bucket_id in('business-assets','product-images') and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_insert on storage.objects for insert to authenticated
with check(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_update on storage.objects for update to authenticated
using(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text)
with check(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

create policy storage_owner_delete on storage.objects for delete to authenticated
using(bucket_id in('business-assets','product-images') and public.current_role()='OWNER' and (storage.foldername(name))[1]=public.current_business_id()::text);

commit;

-- ============================================================================
-- 008_platform_owner_cleanup.sql
-- ============================================================================
begin;

do $$
declare
  v_auth uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_business uuid;
begin
  select business_id into v_business from public.profiles where auth_user_id=v_auth;
  if v_business is null then return; end if;

  if (select count(*) from public.profiles where business_id=v_business)<>1
    or exists(select 1 from public.sales where business_id=v_business)
    or exists(select 1 from public.purchases where business_id=v_business)
    or exists(select 1 from public.products where business_id=v_business)
    or exists(select 1 from public.owners where business_id=v_business)
    or exists(select 1 from public.customers where business_id=v_business)
  then raise exception 'El comercio asociado al propietario de plataforma contiene datos y no puede limpiarse automáticamente';
  end if;

  delete from public.profile_permissions where profile_id in(select id from public.profiles where auth_user_id=v_auth);
  delete from public.profiles where auth_user_id=v_auth;
  delete from public.app_settings where business_id=v_business;
  delete from public.sizes where business_id=v_business;
  delete from public.colors where business_id=v_business;
  delete from public.categories where business_id=v_business;
  delete from public.brands where business_id=v_business;
  delete from public.payment_methods where business_id=v_business;
  delete from public.cash_registers where business_id=v_business;
  delete from public.suppliers where business_id=v_business;
  delete from public.businesses where id=v_business;
end $$;

commit;

-- ============================================================================
-- 009_fix_inventory_adjustment.sql
-- ============================================================================
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

-- ============================================================================
-- 010_atomic_exchanges.sql
-- ============================================================================
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

-- ============================================================================
-- 011_core_hardening.sql
-- ============================================================================
begin;

insert into public.permissions(code, name, module) values
  ('products.read', 'Ver productos', 'Productos'),
  ('products.create', 'Crear productos', 'Productos'),
  ('products.update', 'Editar productos', 'Productos'),
  ('products.delete', 'Desactivar productos', 'Productos'),
  ('stock.read', 'Consultar stock', 'Inventario'),
  ('stock.adjust', 'Ajustar stock', 'Inventario'),
  ('sales.read', 'Consultar ventas', 'Ventas'),
  ('sales.create', 'Realizar ventas', 'Ventas'),
  ('sales.cancel', 'Anular ventas', 'Ventas'),
  ('customers.read', 'Consultar clientes', 'Clientes'),
  ('customers.create', 'Registrar clientes', 'Clientes'),
  ('customers.update', 'Editar clientes', 'Clientes'),
  ('suppliers.read', 'Consultar proveedores', 'Proveedores'),
  ('suppliers.create', 'Registrar proveedores', 'Proveedores'),
  ('purchases.read', 'Consultar compras', 'Compras'),
  ('purchases.create', 'Registrar compras', 'Compras'),
  ('cash.read', 'Consultar caja', 'Caja'),
  ('cash.open', 'Abrir caja', 'Caja'),
  ('cash.close', 'Cerrar caja', 'Caja'),
  ('cash.movements', 'Registrar movimientos de caja', 'Caja'),
  ('reports.read', 'Consultar reportes', 'Reportes'),
  ('users.read', 'Consultar usuarios', 'Usuarios'),
  ('users.create', 'Crear usuarios', 'Usuarios'),
  ('users.update', 'Editar usuarios', 'Usuarios'),
  ('users.delete', 'Activar o desactivar usuarios', 'Usuarios'),
  ('settings.read', 'Consultar configuración', 'Configuración'),
  ('settings.update', 'Editar configuración', 'Configuración'),
  ('returns.create', 'Gestionar devoluciones', 'Posventa'),
  ('exchanges.create', 'Gestionar cambios', 'Posventa')
on conflict(code) do update set name = excluded.name, module = excluded.module;

insert into public.role_permissions(role, permission_code, enabled)
select 'OWNER', code, true from public.permissions
on conflict(role, permission_code) do update set enabled = true;

insert into public.role_permissions(role, permission_code, enabled) values
  ('CASHIER', 'products.read', true),
  ('CASHIER', 'stock.read', true),
  ('CASHIER', 'sales.read', true),
  ('CASHIER', 'sales.create', true),
  ('CASHIER', 'customers.read', true),
  ('CASHIER', 'customers.create', true),
  ('CASHIER', 'cash.read', true),
  ('CASHIER', 'cash.open', true),
  ('CASHIER', 'cash.close', true)
on conflict(role, permission_code) do update set enabled = excluded.enabled;

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
    select sum(case when movement.movement_type = 'OPENING' then 0 else movement.amount end)
    from public.cash_movements movement where movement.cash_session_id = session.id
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
end;
$$;

create or replace function public.complete_sale(
  p_cash_session uuid,
  p_customer uuid,
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_sale uuid;
  v_item jsonb;
  v_payment jsonb;
  v_sale_item uuid;
  v_lot public.inventory_lots%rowtype;
  v_remaining integer;
  v_allocated integer;
  v_total numeric(14,2) := 0;
  v_subtotal numeric(14,2);
  v_paid numeric(14,2) := 0;
  v_previous integer;
  v_variant uuid;
  v_owner uuid;
begin
  if v_profile is null or v_business is null or not public.has_permission('sales.create') then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La venta no tiene productos'; end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then raise exception 'La venta no tiene pagos'; end if;
  if coalesce(p_discount, 0) < 0 then raise exception 'Descuento inválido'; end if;
  if p_customer is not null and not exists(select 1 from public.customers where id = p_customer and business_id = v_business and active) then raise exception 'Cliente inválido'; end if;
  if not exists(
    select 1 from public.cash_sessions
    where id = p_cash_session and business_id = v_business and status = 'OPEN'
      and (opened_by = v_profile or public.current_role() = 'OWNER')
  ) then raise exception 'Caja cerrada o inválida'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item ->> 'quantity')::integer <= 0
      or (v_item ->> 'unit_price')::numeric < 0
      or coalesce((v_item ->> 'discount')::numeric, 0) < 0 then
      raise exception 'Producto de venta inválido';
    end if;
    v_subtotal := (v_item ->> 'quantity')::integer * (v_item ->> 'unit_price')::numeric
      - coalesce((v_item ->> 'discount')::numeric, 0);
    if v_subtotal < 0 then raise exception 'El descuento de un producto supera su importe'; end if;
    v_total := v_total + v_subtotal;
  end loop;
  v_total := round(v_total - coalesce(p_discount, 0), 2);
  if v_total < 0 then raise exception 'El descuento supera el total'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    if (v_payment ->> 'amount')::numeric <= 0 then raise exception 'Importe de pago inválido'; end if;
    if not exists(
      select 1 from public.payment_methods method
      where method.id = (v_payment ->> 'payment_method_id')::uuid
        and method.business_id = v_business
        and (method.active or method.code = 'EXCHANGE_CREDIT')
    ) then raise exception 'Tipo de pago inválido'; end if;
    v_paid := v_paid + (v_payment ->> 'amount')::numeric;
  end loop;
  if round(v_paid, 2) <> v_total then raise exception 'Los pagos no coinciden con el total'; end if;

  insert into public.sales(business_id, cashier_id, customer_id, cash_session_id, subtotal, discount, total)
  values(v_business, v_profile, p_customer, p_cash_session, v_total + coalesce(p_discount, 0), coalesce(p_discount, 0), v_total)
  returning id into v_sale;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant := (v_item ->> 'variant_id')::uuid;
    v_owner := (v_item ->> 'owner_id')::uuid;
    if not exists(select 1 from public.product_variants where id = v_variant and business_id = v_business and active) then raise exception 'Variante inválida'; end if;
    if not exists(select 1 from public.owners where id = v_owner and business_id = v_business and active) then raise exception 'Dueño inválido'; end if;

    v_remaining := (v_item ->> 'quantity')::integer;
    v_subtotal := v_remaining * (v_item ->> 'unit_price')::numeric - coalesce((v_item ->> 'discount')::numeric, 0);
    insert into public.sale_items(sale_id, variant_id, quantity, unit_price, discount, subtotal)
    values(v_sale, v_variant, v_remaining, (v_item ->> 'unit_price')::numeric, coalesce((v_item ->> 'discount')::numeric, 0), v_subtotal)
    returning id into v_sale_item;

    for v_lot in
      select * from public.inventory_lots
      where business_id = v_business and variant_id = v_variant and owner_id = v_owner and available_quantity > 0 and active
      order by received_at, id for update
    loop
      exit when v_remaining = 0;
      v_allocated := least(v_remaining, v_lot.available_quantity);
      update public.inventory_lots set available_quantity = available_quantity - v_allocated where id = v_lot.id;
      insert into public.sale_item_allocations(sale_item_id, owner_id, lot_id, quantity, unit_cost)
      values(v_sale_item, v_lot.owner_id, v_lot.id, v_allocated, v_lot.unit_cost);
      v_remaining := v_remaining - v_allocated;
    end loop;
    if v_remaining > 0 then raise exception 'Stock insuficiente'; end if;

    select quantity into v_previous from public.inventory_balances
    where business_id = v_business and variant_id = v_variant and owner_id = v_owner for update;
    if not found or v_previous < (v_item ->> 'quantity')::integer then raise exception 'Stock insuficiente'; end if;
    update public.inventory_balances set quantity = quantity - (v_item ->> 'quantity')::integer, updated_at = now()
    where business_id = v_business and variant_id = v_variant and owner_id = v_owner;
    insert into public.stock_movements(business_id, variant_id, owner_id, quantity, movement_type, previous_stock, resulting_stock, performed_by, reference_id, reference_type)
    values(v_business, v_variant, v_owner, -(v_item ->> 'quantity')::integer, 'SALE', v_previous,
      v_previous - (v_item ->> 'quantity')::integer, v_profile, v_sale, 'SALE');
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    insert into public.sale_payments(sale_id, payment_method_id, amount, external_reference)
    values(v_sale, (v_payment ->> 'payment_method_id')::uuid, (v_payment ->> 'amount')::numeric, v_payment ->> 'reference');
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, payment_method_id, reference_id, description, performed_by)
    values(v_business, p_cash_session, 'SALE', (v_payment ->> 'amount')::numeric,
      (v_payment ->> 'payment_method_id')::uuid, v_sale, 'Venta', v_profile);
  end loop;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, v_profile, 'CREATE', 'SALE', v_sale);
  return v_sale;
end;
$$;

create or replace function public.register_return(
  p_sale uuid,
  p_allocations jsonb,
  p_reason text,
  p_refund numeric default 0,
  p_cash_session uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_return uuid;
  v_input jsonb;
  v_allocation public.sale_item_allocations%rowtype;
  v_sale_item public.sale_items%rowtype;
  v_previous integer;
  v_total_sold integer;
  v_total_returned integer;
begin
  if public.current_role() <> 'OWNER'
    and not public.has_permission('returns.create')
    and not (public.has_permission('exchanges.create') and lower(coalesce(p_reason, '')) = 'cambio')
  then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then raise exception 'No hay productos para devolver'; end if;
  if coalesce(p_refund, 0) < 0 then raise exception 'Reintegro inválido'; end if;
  if not exists(select 1 from public.sales where id = p_sale and business_id = v_business and status in('COMPLETED','PARTIALLY_RETURNED')) then raise exception 'Venta no disponible'; end if;
  if p_refund > 0 and not exists(
    select 1 from public.cash_sessions where id = p_cash_session and business_id = v_business and status = 'OPEN'
      and (opened_by = v_profile or public.current_role() = 'OWNER')
  ) then raise exception 'Se requiere una caja abierta para reintegrar'; end if;

  insert into public.returns(business_id, original_sale_id, cash_session_id, processed_by, reason, refund_amount)
  values(v_business, p_sale, p_cash_session, v_profile, coalesce(nullif(btrim(p_reason), ''), 'Devolución'), coalesce(p_refund, 0))
  returning id into v_return;

  for v_input in select value from jsonb_array_elements(p_allocations)
  loop
    select allocation.* into v_allocation
    from public.sale_item_allocations allocation
    join public.sale_items item on item.id = allocation.sale_item_id
    where allocation.id = (v_input ->> 'allocation_id')::uuid and item.sale_id = p_sale
    for update of allocation;
    if not found then raise exception 'Asignación de venta inválida'; end if;
    select * into v_sale_item from public.sale_items where id = v_allocation.sale_item_id;
    if (v_input ->> 'quantity')::integer <= 0 or (v_input ->> 'quantity')::integer > v_allocation.quantity - coalesce((
      select sum(item.quantity) from public.return_items item where item.sale_item_allocation_id = v_allocation.id
    ), 0) then raise exception 'Cantidad de devolución inválida'; end if;

    insert into public.return_items(return_id, sale_item_allocation_id, quantity, condition)
    values(v_return, v_allocation.id, (v_input ->> 'quantity')::integer, coalesce(v_input ->> 'condition', 'GOOD'));
    update public.inventory_lots set available_quantity = available_quantity + (v_input ->> 'quantity')::integer
    where id = v_allocation.lot_id;
    select quantity into v_previous from public.inventory_balances
    where business_id = v_business and variant_id = v_sale_item.variant_id and owner_id = v_allocation.owner_id for update;
    update public.inventory_balances set quantity = quantity + (v_input ->> 'quantity')::integer, updated_at = now()
    where business_id = v_business and variant_id = v_sale_item.variant_id and owner_id = v_allocation.owner_id;
    insert into public.stock_movements(business_id, variant_id, owner_id, lot_id, quantity, movement_type, previous_stock, resulting_stock, performed_by, reference_id, reference_type, notes)
    values(v_business, v_sale_item.variant_id, v_allocation.owner_id, v_allocation.lot_id,
      (v_input ->> 'quantity')::integer, 'RETURN', v_previous,
      v_previous + (v_input ->> 'quantity')::integer, v_profile, v_return, 'RETURN', p_reason);
  end loop;

  if p_refund > 0 then
    insert into public.cash_movements(business_id, cash_session_id, movement_type, amount, reference_id, description, performed_by)
    values(v_business, p_cash_session, 'REFUND', -p_refund, v_return, 'Devolución', v_profile);
  end if;

  select coalesce(sum(quantity), 0) into v_total_sold from public.sale_items where sale_id = p_sale;
  select coalesce(sum(returned.quantity), 0) into v_total_returned
  from public.return_items returned
  join public.sale_item_allocations allocation on allocation.id = returned.sale_item_allocation_id
  join public.sale_items item on item.id = allocation.sale_item_id
  where item.sale_id = p_sale;
  update public.sales set status = case
    when v_total_returned >= v_total_sold then 'RETURNED'::public.sale_status
    else 'PARTIALLY_RETURNED'::public.sale_status end
  where id = p_sale;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_business, v_profile, 'CREATE', 'RETURN', v_return, jsonb_build_object('sale_id', p_sale));
  return v_return;
end;
$$;

create or replace function public.create_and_confirm_purchase(
  p_supplier uuid,
  p_owner uuid,
  p_receipt_number text,
  p_purchased_at timestamptz,
  p_discount numeric,
  p_tax numeric,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_profile uuid := public.current_profile_id();
  v_purchase uuid;
  v_item jsonb;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
begin
  if v_business is null or v_profile is null or public.current_role() <> 'OWNER' then raise exception 'Permiso denegado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La compra no tiene productos'; end if;
  if not exists(select 1 from public.owners where id = p_owner and business_id = v_business and active) then raise exception 'Dueño inválido'; end if;
  if p_supplier is not null and not exists(select 1 from public.suppliers where id = p_supplier and business_id = v_business and active) then raise exception 'Proveedor inválido'; end if;
  if coalesce(p_discount, 0) < 0 or coalesce(p_tax, 0) < 0 then raise exception 'Importes inválidos'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if (v_item ->> 'quantity')::integer <= 0
      or (v_item ->> 'unit_cost')::numeric < 0
      or coalesce((v_item ->> 'discount')::numeric, 0) < 0 then raise exception 'Producto de compra inválido'; end if;
    if not exists(select 1 from public.product_variants where id = (v_item ->> 'variant_id')::uuid and business_id = v_business and active) then raise exception 'Variante inválida'; end if;
    v_subtotal := v_subtotal + (v_item ->> 'quantity')::integer * (v_item ->> 'unit_cost')::numeric - coalesce((v_item ->> 'discount')::numeric, 0);
  end loop;
  v_total := round(v_subtotal - coalesce(p_discount, 0) + coalesce(p_tax, 0), 2);
  if v_total < 0 then raise exception 'El descuento supera el subtotal'; end if;

  insert into public.purchases(business_id, supplier_id, owner_id, created_by, receipt_number, purchased_at, subtotal, discount, tax, total, notes)
  values(v_business, p_supplier, p_owner, v_profile, nullif(btrim(p_receipt_number), ''), coalesce(p_purchased_at, now()),
    v_subtotal, coalesce(p_discount, 0), coalesce(p_tax, 0), v_total, nullif(btrim(p_notes), ''))
  returning id into v_purchase;

  insert into public.purchase_items(purchase_id, variant_id, quantity, unit_cost, discount)
  select v_purchase, (entry.value ->> 'variant_id')::uuid, (entry.value ->> 'quantity')::integer,
    (entry.value ->> 'unit_cost')::numeric, coalesce((entry.value ->> 'discount')::numeric, 0)
  from jsonb_array_elements(p_items) entry;

  perform public.confirm_purchase(v_purchase);
  return v_purchase;
end;
$$;

create or replace function public.save_product(p_product_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid := public.current_business_id();
  v_product uuid;
  v_variant jsonb;
  v_image jsonb;
  v_variant_id uuid;
  v_size_id uuid;
  v_color_id uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_business is null then raise exception 'No existe un comercio activo'; end if;
  if p_product_id is null and public.current_role() <> 'OWNER' and not public.has_permission('products.create') then raise exception 'Permiso denegado'; end if;
  if p_product_id is not null and public.current_role() <> 'OWNER' and not public.has_permission('products.update') then raise exception 'Permiso denegado'; end if;
  if nullif(btrim(p_data ->> 'name'), '') is null or nullif(btrim(p_data ->> 'sku'), '') is null then raise exception 'Nombre y SKU son obligatorios'; end if;
  if (p_data ->> 'base_price')::numeric < 0 or coalesce((p_data ->> 'base_cost')::numeric, 0) < 0 then raise exception 'Precios inválidos'; end if;
  if jsonb_typeof(p_data -> 'variants') <> 'array' or jsonb_array_length(p_data -> 'variants') = 0 then raise exception 'El producto debe tener al menos una variante'; end if;
  if nullif(p_data ->> 'category_id', '') is not null and not exists(select 1 from public.categories where id = (p_data ->> 'category_id')::uuid and business_id = v_business) then raise exception 'Categoría inválida'; end if;
  if nullif(p_data ->> 'brand_id', '') is not null and not exists(select 1 from public.brands where id = (p_data ->> 'brand_id')::uuid and business_id = v_business) then raise exception 'Marca inválida'; end if;

  if p_product_id is null then
    insert into public.products(business_id, sku, name, description, category_id, brand_id, base_cost, base_price, promotional_price, minimum_stock, active)
    values(v_business, btrim(p_data ->> 'sku'), btrim(p_data ->> 'name'), nullif(btrim(p_data ->> 'description'), ''),
      nullif(p_data ->> 'category_id', '')::uuid, nullif(p_data ->> 'brand_id', '')::uuid,
      nullif(p_data ->> 'base_cost', '')::numeric, (p_data ->> 'base_price')::numeric,
      nullif(p_data ->> 'promotional_price', '')::numeric, coalesce((p_data ->> 'minimum_stock')::integer, 0),
      coalesce((p_data ->> 'active')::boolean, true))
    returning id into v_product;
  else
    update public.products set
      sku = btrim(p_data ->> 'sku'), name = btrim(p_data ->> 'name'), description = nullif(btrim(p_data ->> 'description'), ''),
      category_id = nullif(p_data ->> 'category_id', '')::uuid, brand_id = nullif(p_data ->> 'brand_id', '')::uuid,
      base_cost = nullif(p_data ->> 'base_cost', '')::numeric, base_price = (p_data ->> 'base_price')::numeric,
      promotional_price = nullif(p_data ->> 'promotional_price', '')::numeric,
      minimum_stock = coalesce((p_data ->> 'minimum_stock')::integer, 0), active = coalesce((p_data ->> 'active')::boolean, true)
    where id = p_product_id and business_id = v_business returning id into v_product;
    if v_product is null then raise exception 'Producto inexistente'; end if;
  end if;

  for v_variant in select value from jsonb_array_elements(p_data -> 'variants')
  loop
    if nullif(btrim(v_variant ->> 'sku'), '') is null or nullif(btrim(v_variant ->> 'barcode'), '') is null then raise exception 'Cada variante necesita SKU y código de barras'; end if;
    if (v_variant ->> 'price')::numeric < 0 or coalesce((v_variant ->> 'cost')::numeric, 0) < 0 then raise exception 'Precio de variante inválido'; end if;

    v_size_id := null;
    if nullif(btrim(v_variant ->> 'size'), '') is not null then
      insert into public.sizes(business_id, name) values(v_business, btrim(v_variant ->> 'size'))
      on conflict(business_id, name) do update set active = true returning id into v_size_id;
    end if;
    v_color_id := null;
    if nullif(btrim(v_variant ->> 'color'), '') is not null then
      insert into public.colors(business_id, name) values(v_business, btrim(v_variant ->> 'color'))
      on conflict(business_id, name) do update set active = true returning id into v_color_id;
    end if;

    v_variant_id := coalesce(nullif(v_variant ->> 'id', '')::uuid, gen_random_uuid());
    if exists(select 1 from public.product_variants where id = v_variant_id and (business_id <> v_business or product_id <> v_product)) then raise exception 'Variante inválida'; end if;
    insert into public.product_variants(id, business_id, product_id, size_id, color_id, sku, barcode, cost, price, minimum_stock, active)
    values(v_variant_id, v_business, v_product, v_size_id, v_color_id, btrim(v_variant ->> 'sku'), btrim(v_variant ->> 'barcode'),
      nullif(v_variant ->> 'cost', '')::numeric, (v_variant ->> 'price')::numeric,
      coalesce((p_data ->> 'minimum_stock')::integer, 0), coalesce((v_variant ->> 'active')::boolean, true))
    on conflict(id) do update set size_id = excluded.size_id, color_id = excluded.color_id, sku = excluded.sku,
      barcode = excluded.barcode, cost = excluded.cost, price = excluded.price,
      minimum_stock = excluded.minimum_stock, active = excluded.active;
    v_seen := array_append(v_seen, v_variant_id);
  end loop;
  update public.product_variants set active = false
  where product_id = v_product and business_id = v_business and not (id = any(v_seen));

  delete from public.product_images where product_id = v_product;
  if jsonb_typeof(p_data -> 'images') = 'array' then
    for v_image in select value from jsonb_array_elements(p_data -> 'images')
    loop
      if nullif(v_image ->> 'path', '') is not null then
        insert into public.product_images(product_id, storage_path, sort_order)
        values(v_product, v_image ->> 'path', coalesce((v_image ->> 'order')::integer, 0));
      end if;
    end loop;
  end if;

  insert into public.audit_logs(business_id, actor_profile_id, action, entity_type, entity_id)
  values(v_business, public.current_profile_id(), case when p_product_id is null then 'CREATE' else 'UPDATE' end, 'PRODUCT', v_product);
  return v_product;
end;
$$;

revoke all on function public.open_cash_register(uuid,numeric),
  public.close_cash_register(uuid,numeric,text),
  public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),
  public.register_return(uuid,jsonb,text,numeric,uuid),
  public.save_product(uuid,jsonb),
  public.create_and_confirm_purchase(uuid,uuid,text,timestamptz,numeric,numeric,text,jsonb) from public;
grant execute on function public.open_cash_register(uuid,numeric),
  public.close_cash_register(uuid,numeric,text),
  public.complete_sale(uuid,uuid,jsonb,jsonb,numeric),
  public.register_return(uuid,jsonb,text,numeric,uuid),
  public.save_product(uuid,jsonb),
  public.create_and_confirm_purchase(uuid,uuid,text,timestamptz,numeric,numeric,text,jsonb) to authenticated;

commit;

-- ============================================================================
-- 012_zero_opening_cash.sql
-- ============================================================================
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

-- ============================================================================
-- 013_net_sales_reports.sql
-- ============================================================================
begin;

create or replace view public.owner_sales_summary
with (security_invoker = true)
as
select
  sale.business_id,
  allocation.owner_id,
  owner.first_name as owner_first_name,
  owner.last_name as owner_last_name,
  date_trunc('day', sale.created_at) as sale_day,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0))) as gross_sales,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * allocation.unit_cost) as cost,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * ((item.subtotal / nullif(item.quantity, 0)) - allocation.unit_cost)) as estimated_profit,
  sum(allocation.quantity - coalesce(returned.quantity, 0)) as units
from public.sales sale
join public.sale_items item on item.sale_id = sale.id
join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
join public.owners owner on owner.id = allocation.owner_id
left join lateral (
  select coalesce(sum(return_item.quantity), 0)::integer as quantity
  from public.return_items return_item
  where return_item.sale_item_allocation_id = allocation.id
) returned on true
where sale.status <> 'CANCELLED'
  and allocation.quantity - coalesce(returned.quantity, 0) > 0
group by sale.business_id, allocation.owner_id, owner.first_name, owner.last_name, date_trunc('day', sale.created_at);

create or replace view public.dashboard_summary
with (security_invoker = true)
as
select
  business.id as business_id,
  coalesce((
    select sum(net.net_total)
    from (
      select sale.id, sale.created_at,
        greatest(
          sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
          - sale.discount * (
              sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
              / nullif(sale.subtotal, 0)
            ),
          0
        ) as net_total
      from public.sales sale
      join public.sale_items item on item.sale_id = sale.id
      join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
      left join lateral (
        select coalesce(sum(return_item.quantity), 0)::integer as quantity
        from public.return_items return_item
        where return_item.sale_item_allocation_id = allocation.id
      ) returned on true
      where sale.business_id = business.id and sale.status <> 'CANCELLED'
      group by sale.id
    ) net
    where net.created_at >= current_date
  ), 0) as today_sales,
  coalesce((
    select sum(net.net_total)
    from (
      select sale.id, sale.created_at,
        greatest(
          sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
          - sale.discount * (
              sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
              / nullif(sale.subtotal, 0)
            ),
          0
        ) as net_total
      from public.sales sale
      join public.sale_items item on item.sale_id = sale.id
      join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
      left join lateral (
        select coalesce(sum(return_item.quantity), 0)::integer as quantity
        from public.return_items return_item
        where return_item.sale_item_allocation_id = allocation.id
      ) returned on true
      where sale.business_id = business.id and sale.status <> 'CANCELLED'
      group by sale.id
    ) net
    where net.created_at >= date_trunc('month', now())
  ), 0) as month_sales,
  coalesce((select sum(balance.quantity) from public.inventory_balances balance where balance.business_id = business.id), 0) as total_stock,
  coalesce((
    select count(*) from public.inventory_balances balance
    join public.product_variants variant on variant.id = balance.variant_id
    where balance.business_id = business.id and variant.active and balance.quantity <= variant.minimum_stock
  ), 0) as low_stock
from public.businesses business;

grant select on public.owner_sales_summary, public.dashboard_summary to authenticated;

commit;

-- ============================================================================
-- 014_inventory_noop_and_scope.sql
-- ============================================================================
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

-- ============================================================================
-- 015_inventory_fifo_lock.sql
-- ============================================================================
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

-- ============================================================================
-- 016_permissions_cash_audit.sql
-- ============================================================================
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

-- ============================================================================
-- 017_operational_completion.sql
-- ============================================================================
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

-- ============================================================================
-- 018_refund_payment_clarity.sql
-- ============================================================================
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

-- ============================================================================
-- 019_product_catalog_fidelity.sql
-- ============================================================================
begin;

alter table public.products
  add column if not exists internal_code text,
  add column if not exists barcode text,
  add column if not exists maximum_stock integer not null default 0;

update public.products product
set internal_code = coalesce(product.internal_code, product.sku),
    barcode = coalesce(product.barcode, (
      select variant.barcode from public.product_variants variant
      where variant.product_id = product.id order by variant.created_at, variant.id limit 1
    ));

alter table public.products drop constraint if exists products_maximum_stock_nonnegative;
alter table public.products add constraint products_maximum_stock_nonnegative check(maximum_stock >= 0);
create unique index if not exists products_business_internal_code_unique
  on public.products(business_id, internal_code) where internal_code is not null;
create unique index if not exists products_business_barcode_unique
  on public.products(business_id, barcode) where barcode is not null;

create or replace function public.save_product_complete(p_product_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
  v_business uuid := public.current_business_id();
  v_minimum integer := coalesce((p_data ->> 'minimum_stock')::integer, 0);
  v_maximum integer := coalesce((p_data ->> 'maximum_stock')::integer, 0);
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
  return v_product;
end;
$$;

revoke all on function public.save_product_complete(uuid,jsonb) from public;
grant execute on function public.save_product_complete(uuid,jsonb) to authenticated;

commit;

-- ============================================================================
-- 020_service_role_api_access.sql
-- ============================================================================
begin;

-- Las Edge Functions usan service_role. BYPASSRLS no reemplaza los permisos
-- SQL básicos de esquema/objetos, por lo que deben concederse explícitamente.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

commit;

-- ============================================================================
-- 021_automatic_product_labels.sql
-- ============================================================================
begin;

create table if not exists public.product_labels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  sku text not null,
  barcode text not null,
  active boolean not null default true,
  print_count integer not null default 0 check(print_count >= 0),
  last_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id, barcode)
);

create index if not exists product_labels_business_product_idx
  on public.product_labels(business_id, product_id);

alter table public.product_labels enable row level security;
drop policy if exists product_labels_owner_read on public.product_labels;
create policy product_labels_owner_read on public.product_labels
for select to authenticated
using(business_id=public.current_business_id() and public.current_role()='OWNER');

grant select on public.product_labels to authenticated;

create or replace function public.sync_product_variant_label()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.product_labels(business_id,product_id,variant_id,sku,barcode,active)
  values(new.business_id,new.product_id,new.id,new.sku,new.barcode,new.active)
  on conflict(variant_id) do update set
    business_id=excluded.business_id,
    product_id=excluded.product_id,
    sku=excluded.sku,
    barcode=excluded.barcode,
    active=excluded.active,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists product_variants_sync_label on public.product_variants;
create trigger product_variants_sync_label
after insert or update of sku,barcode,active,product_id on public.product_variants
for each row execute function public.sync_product_variant_label();

insert into public.product_labels(business_id,product_id,variant_id,sku,barcode,active)
select variant.business_id,variant.product_id,variant.id,variant.sku,variant.barcode,variant.active
from public.product_variants variant
on conflict(variant_id) do update set
  sku=excluded.sku,barcode=excluded.barcode,active=excluded.active,updated_at=now();

create or replace function public.mark_product_labels_printed(p_variant_ids uuid[])
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if public.current_role()<>'OWNER' then raise exception 'Permiso denegado'; end if;
  update public.product_labels
  set print_count=print_count+1,last_printed_at=now(),updated_at=now()
  where business_id=public.current_business_id() and variant_id=any(p_variant_ids) and active;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_product_labels_printed(uuid[]) from public;
grant execute on function public.mark_product_labels_printed(uuid[]) to authenticated;

commit;

-- ============================================================================
-- CATÁLOGO DE PERMISOS (SEED)
-- ============================================================================
insert into public.permissions(code,name,module) values
  ('products.read','Ver productos','Productos'),
  ('products.create','Crear productos','Productos'),
  ('products.update','Editar productos','Productos'),
  ('products.delete','Desactivar productos','Productos'),
  ('stock.read','Consultar stock','Inventario'),
  ('stock.adjust','Ajustar stock','Inventario'),
  ('sales.read','Consultar ventas','Ventas'),
  ('sales.create','Realizar ventas','Ventas'),
  ('sales.cancel','Anular ventas','Ventas'),
  ('customers.read','Consultar clientes','Clientes'),
  ('customers.create','Registrar clientes','Clientes'),
  ('customers.update','Editar clientes','Clientes'),
  ('suppliers.read','Consultar proveedores','Proveedores'),
  ('suppliers.create','Registrar proveedores','Proveedores'),
  ('purchases.read','Consultar compras','Compras'),
  ('purchases.create','Registrar compras','Compras'),
  ('cash.read','Consultar caja','Caja'),
  ('cash.open','Abrir caja','Caja'),
  ('cash.close','Cerrar caja','Caja'),
  ('cash.movements','Registrar movimientos de caja','Caja'),
  ('reports.read','Consultar reportes','Reportes'),
  ('users.read','Consultar usuarios','Usuarios'),
  ('users.create','Crear usuarios','Usuarios'),
  ('users.update','Editar usuarios','Usuarios'),
  ('users.delete','Activar o desactivar usuarios','Usuarios'),
  ('settings.read','Consultar configuración','Configuración'),
  ('settings.update','Editar configuración','Configuración'),
  ('returns.create','Gestionar devoluciones','Posventa'),
  ('exchanges.create','Gestionar cambios','Posventa')
on conflict(code) do update set name=excluded.name,module=excluded.module;

insert into public.role_permissions(role,permission_code,enabled)
select 'OWNER',code,true from public.permissions
on conflict(role,permission_code) do update set enabled=true;

insert into public.role_permissions(role,permission_code,enabled) values
  ('CASHIER','products.read',true),
  ('CASHIER','stock.read',true),
  ('CASHIER','sales.read',true),
  ('CASHIER','sales.create',true),
  ('CASHIER','customers.read',true),
  ('CASHIER','customers.create',true),
  ('CASHIER','cash.read',true),
  ('CASHIER','cash.open',true),
  ('CASHIER','cash.close',true)
on conflict(role,permission_code) do update set enabled=excluded.enabled;

-- Los tipos de pago se crean desde Configuración o al dar de alta un comercio.
-- Son etiquetas declarativas: VESTIA no crea cobros, QR, links ni integraciones externas.

