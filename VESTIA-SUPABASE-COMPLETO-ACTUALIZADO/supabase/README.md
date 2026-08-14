# Base de datos VESTIA

## Aplicación

1. Instalar Supabase CLI y vincular el proyecto: `supabase link --project-ref <ref>`.
2. Aplicar las migraciones: `supabase db push`.
3. Cargar catálogos/permisos: `supabase db seed`.
4. Crear el primer usuario en Supabase Auth y luego insertar su `profile` con rol `OWNER`.

Las migraciones se ejecutan en orden:

- `001_initial_schema.sql`: entidades, relaciones, índices y constraints.
- `002_security_rls.sql`: helpers de sesión y políticas RLS.
- `003_functions.sql`: operaciones atómicas de compra, venta y caja.

El frontend utiliza exclusivamente la clave publicable. La `service_role` no debe incorporarse al bundle Angular.

## Modelo de stock

`inventory_lots` conserva la procedencia y costo; `inventory_balances` acelera consultas por variante/dueño; `stock_movements` conserva el historial. Sólo las funciones SQL actualizan estas tres estructuras coordinadamente.
