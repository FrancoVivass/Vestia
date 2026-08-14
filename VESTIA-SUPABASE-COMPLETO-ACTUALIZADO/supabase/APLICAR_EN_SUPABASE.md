# Aplicar la base completa de VESTIA en Supabase

## Opción recomendada: Supabase CLI

Desde la raíz del proyecto:

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase db seed
npx supabase functions deploy create-user
```

Configurar los secretos de la Edge Function desde el panel o CLI. Supabase incorpora automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en las funciones desplegadas.

## Orden de las migraciones

1. `001_initial_schema.sql`
2. `002_security_rls.sql`
3. `003_functions.sql`
4. `004_returns_reports.sql`
5. `005_inventory_cash_operations.sql`
6. `006_bootstrap_primary_owner.sql`
7. `seed.sql`

Si se usa el SQL Editor del panel, abrir cada archivo, copiar su contenido completo y ejecutarlo respetando ese orden. No ejecutar archivos parcialmente.

## Usuario OWNER configurado

La migración `006_bootstrap_primary_owner.sql` ya configura automáticamente como OWNER al usuario Auth:

`9cce2750-ff96-4c16-bc01-df86c03017e6`

Toma el email y nombre directamente de `auth.users`, crea el comercio VESTIA y carga caja, talles, configuración y formas de pago iniciales.

## Crear manualmente otro primer comercio y usuario OWNER

Primero crear el usuario desde Authentication > Users. Copiar su UUID y ejecutar, reemplazando los valores entre `<...>`:

```sql
do $$
declare
  v_business_id uuid;
begin
  insert into public.businesses(name, legal_name, tax_id, email, phone, address)
  values ('Mi local', 'Mi local', null, '<EMAIL>', null, null)
  returning id into v_business_id;

  insert into public.profiles(
    auth_user_id, business_id, first_name, last_name, email, role, active
  ) values (
    '<UUID_AUTH_USER>'::uuid,
    v_business_id,
    '<NOMBRE>',
    '<APELLIDO>',
    '<EMAIL>',
    'OWNER',
    true
  );

  insert into public.payment_methods(business_id, code, name) values
    (v_business_id, 'CASH', 'Efectivo'),
    (v_business_id, 'DEBIT', 'Débito'),
    (v_business_id, 'CREDIT', 'Crédito'),
    (v_business_id, 'TRANSFER', 'Transferencia'),
    (v_business_id, 'MERCADOPAGO', 'Mercado Pago'),
    (v_business_id, 'QR', 'QR'),
    (v_business_id, 'OTHER', 'Otro');

  insert into public.cash_registers(business_id, name)
  values (v_business_id, 'Caja principal');

  insert into public.sizes(business_id, name, sort_order) values
    (v_business_id, 'XS', 1), (v_business_id, 'S', 2),
    (v_business_id, 'M', 3), (v_business_id, 'L', 4),
    (v_business_id, 'XL', 5), (v_business_id, 'XXL', 6),
    (v_business_id, '36', 7), (v_business_id, '38', 8),
    (v_business_id, '40', 9), (v_business_id, '42', 10),
    (v_business_id, '44', 11), (v_business_id, '46', 12);

  insert into public.app_settings(business_id, store_name)
  values (v_business_id, 'Mi local');
end $$;
```

`Mercado Pago` y `QR` son únicamente nombres declarativos de formas de pago. El sistema no crea cobros, QR, webhooks ni conexiones con APIs externas.

## Storage

Crear desde Storage los buckets:

- `business-assets`
- `product-images`

Mantenerlos privados y añadir políticas por `business_id` antes de permitir cargas desde producción.

## Verificación rápida

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Después de aplicar todo, iniciar sesión con el OWNER y comprobar: apertura de caja, creación de dueño, producto/variante, compra, inventario y venta.
