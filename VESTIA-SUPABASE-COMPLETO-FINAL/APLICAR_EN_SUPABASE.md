# Aplicar VESTIA en Supabase

La base se instala con todas las migraciones en orden y luego se despliegan las dos Edge Functions.

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase db seed
npx supabase functions deploy create-business
npx supabase functions deploy create-user
```

## Contenido

- `001` a `009`: esquema comercial, RLS, funciones de venta/compra/caja, plataforma y Storage.
- `010`: cambios atómicos.
- `011`: endurecimiento de permisos y operaciones atómicas de producto y compra.
- `012`: apertura válida de caja con monto cero.
- `013`: reportes de ventas netos de devoluciones.
- `014` y `015`: ajustes de inventario seguros y consumo FIFO bloqueado.
- `016`: permisos operativos, arqueo por tipo de pago y auditoría de acceso/caja.

## Propietario de plataforma

El UUID configurado en `006_platform_owner.sql` accede exclusivamente a `/platform/comercios`. Desde ese panel crea cada comercio, carga su logo y define el email y la contraseña inicial de su usuario OWNER.

El logo queda en el bucket privado `business-assets`, bajo la carpeta del comercio, y se muestra en su header mediante una URL firmada.

## Formas de pago

Efectivo, Débito, Crédito, Transferencia, Mercado Pago, QR y Otro son tipos declarativos. VESTIA no crea cobros, links, QR, webhooks ni integraciones externas.

## Seguridad

El frontend usa exclusivamente la URL y clave publicable. La clave `service_role` permanece dentro de Supabase Edge Functions. Las tablas sensibles usan RLS y las operaciones de stock, venta, compra, devolución, cambio y caja se ejecutan mediante funciones PostgreSQL transaccionales.
