# Publicar VESTIA en Cloudflare Pages

El proyecto ya está preparado como SPA Angular estática. Supabase continúa siendo el backend.

## Despliegue directo

```powershell
npm install
npm run deploy:cloudflare
```

El comando compila en `dist/cloudflare/browser` y publica el proyecto Pages `vestia`.

## Despliegue conectado a Git

- Rama de producción: `main`
- Comando de compilación: `npm run build:cloudflare`
- Directorio de salida: `dist/cloudflare/browser`
- Versión de Node.js: `22`

## Autenticación de Supabase

Después del primer despliegue, agregá la URL `https://vestia.pages.dev` (y el dominio propio, si corresponde) en Supabase → Authentication → URL Configuration:

- Site URL: URL pública definitiva.
- Redirect URLs: `https://vestia.pages.dev/**` y el dominio propio con `/**`.

Esto permite que GitHub, la recuperación de contraseña y los enlaces de autenticación regresen correctamente a VESTIA.

La clave publicable de Supabase puede estar en el frontend. Nunca agregues `SUPABASE_SERVICE_ROLE_KEY` a Cloudflare Pages ni al código del navegador.
