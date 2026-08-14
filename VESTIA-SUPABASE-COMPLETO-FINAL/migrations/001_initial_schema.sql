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

