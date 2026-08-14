# Aplicar VESTIA en Supabase

## Proyecto actual

El proyecto vinculado ya tiene aplicadas las migraciones `001` a `020` y las funciones `create-business` y `create-user` están activas. No vuelvas a pegar el SQL consolidado sobre esa misma base.

Para futuras actualizaciones:

```powershell
npx supabase@latest link --project-ref TU_PROJECT_REF
npx supabase@latest db push --linked
npx supabase@latest functions deploy create-business --project-ref TU_PROJECT_REF --no-verify-jwt
npx supabase@latest functions deploy create-user --project-ref TU_PROJECT_REF --no-verify-jwt
```

## Proyecto Supabase nuevo

1. Crear el proyecto y habilitar Email/Password y GitHub en Authentication.
2. Iniciar sesión una vez con GitHub para que exista el usuario de plataforma en `auth.users`.
3. Ajustar el UUID de `006_platform_owner.sql` si el nuevo proyecto asignó otro UUID.
4. Ejecutar las migraciones con `db push`, o pegar una sola vez `VESTIA_BASE_DATOS_COMPLETA_2026-08-14.sql` en SQL Editor.
5. Desplegar las dos Edge Functions con los comandos anteriores.
6. Agregar las URL del frontend a Authentication > URL Configuration.

## Contenido

- `001` a `016`: esquema, RLS, Storage, compras, ventas, caja, devoluciones, cambios, permisos y reportes netos.
- `017`: gastos, inventario físico, anulación de ventas, liquidaciones e identidad del comercio.
- `018`: tipo de pago explícito en devoluciones y diferencias de cambios.
- `019`: persistencia completa de código interno, código de barras y stock máximo del catálogo.
- `020`: permisos administrativos de `service_role` requeridos por las Edge Functions.

La clave `service_role` nunca se coloca en Angular. Permanece dentro de Supabase Edge Functions. La URL y la clave publicable sí son valores del frontend.
