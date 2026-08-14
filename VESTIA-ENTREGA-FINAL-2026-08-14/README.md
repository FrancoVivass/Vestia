# VESTIA

Sistema profesional de gestión para locales de indumentaria con mercadería perteneciente a múltiples dueños.

## Funciones incluidas

- Alta de comercios desde la cuenta propietaria de plataforma, con logo y credenciales OWNER.
- Login por GitHub para la cuenta de plataforma y por email/contraseña para cada comercio.
- Usuarios OWNER/CAJERO y 29 permisos configurables.
- Productos, imágenes, variantes, talles, colores, SKU, código interno y barras.
- Compras, lotes FIFO, stock por dueño, ajustes e inventario físico.
- POS con pagos combinados declarativos, caja, tickets de 58/80 mm y anulación de ventas.
- Clientes, proveedores y dueños.
- Devoluciones y cambios con tipo de pago explícito para reintegros o diferencias.
- Gastos, reportes, exportación CSV/Excel, liquidaciones históricas y auditoría.
- Etiquetas CODE128 configurables con producto, variante, dueño y precio.

Los tipos de pago solamente registran cómo se pagó. VESTIA no genera cobros, links, QR ni operaciones en Mercado Pago u otras plataformas.

## Tecnología

- Angular 22 y TypeScript.
- Supabase Auth, Storage, Edge Functions y PostgreSQL.
- Row Level Security por comercio.
- Funciones PostgreSQL transaccionales para stock, ventas, compras, caja y posventa.

## Ejecutar

Requiere Node.js 22 LTS (`.nvmrc`) y npm.

```powershell
npm install
npm start
```

Abrir `http://localhost:4200`.

## Verificación

```powershell
npm run build
npm test -- --watch=false
npx supabase@latest db lint --linked --level warning
```

## Supabase

Las migraciones `001` a `020` están en `supabase/migrations`. El SQL consolidado se encuentra en `supabase/VESTIA_BASE_DATOS_COMPLETA_2026-08-14.sql`. Las instrucciones completas están en `supabase/APLICAR_EN_SUPABASE.md`.

Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`. El frontend utiliza únicamente la URL y la clave publicable.
