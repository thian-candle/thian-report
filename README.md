# Thian Candle — Gestión de pedidos

Aplicación React + Vite + Supabase. Vendedores registran pedidos con múltiples productos; el administrador gestiona catálogo, vendedores y estados de producción por línea.

## 1. Crear base de datos
1. Crea un proyecto en https://supabase.com/.
2. En **SQL Editor**, ejecuta todo `supabase/schema.sql` (una sola vez).
3. En **Authentication > Providers > Email**, configura la confirmación por correo según tu política. **Importante:** en la versión 1, cualquier persona que llegue al formulario público puede solicitar crear una cuenta de vendedor. Para uso real con vendedores conocidos, desactiva los registros públicos después de darles acceso, o implementa invitaciones administradas.
4. Registra la primera cuenta desde la pantalla de la aplicación. Si se solicita confirmación, confirma el correo.
5. En **SQL Editor**, promueve SOLO esa cuenta al rol administrador, reemplazando el correo:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'TU_CORREO@EJEMPLO.COM');
```

6. Los demás usuarios se registran como `seller` automáticamente. El administrador puede desactivar vendedores desde la aplicación.

## 2. Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env
# Editar .env con Project URL y publishable/anon key de Supabase
npm run dev
```

Usa **solo** la clave pública `anon`/publishable de Supabase en `VITE_SUPABASE_ANON_KEY`. **Nunca** uses la clave `service_role`/secret en el frontend o GitHub Pages.

## 3. Publicar en GitHub Pages
1. Crea un repositorio de GitHub (por ejemplo, `thian-orders`) y sube estos archivos a la rama `main`.
2. En **Settings > Secrets and variables > Actions > Variables**, crea:
   - `VITE_SUPABASE_URL` = URL del proyecto
   - `VITE_SUPABASE_ANON_KEY` = clave pública publishable/anon
3. En **Settings > Pages > Build and deployment**, selecciona **GitHub Actions**.
4. Ejecuta el workflow **Deploy GitHub Pages** o haz push a `main`.
5. La URL quedará como `https://TU_USUARIO.github.io/NOMBRE_REPOSITORIO/`.
6. En Supabase **Authentication > URL Configuration**, agrega la URL publicada a las URLs de redirección autorizadas y configura la URL del sitio según tu despliegue.

El build calcula automáticamente la ruta base a partir del nombre del repositorio.

## Seguridad y limitaciones V1
- Row Level Security protege tablas. Vendedores ven únicamente sus pedidos y productos; administradores ven todos.
- Solo administradores pueden cambiar el estado de producción o activar/desactivar vendedores y productos.
- El registro de pedido y sus líneas es transaccional mediante la función `create_order`.
- No hay edición de pedidos, invitaciones administradas, recuperación de contraseña en interfaz, carga de fotografías a Storage ni auditoría de cambios en esta versión.
- No se almacenan precios, de acuerdo con el alcance inicial.
- En producción, se recomienda reemplazar el registro público por invitaciones de administradores y agregar registro de auditoría.

## Actualización V1.1: usuarios con múltiples roles

Si ya ejecutaste `schema.sql` y los scripts de creación de `roles`, `user_roles`, `has_role` y `my_roles` en Supabase, **NO vuelvas a ejecutar `schema.sql`**. Ejecuta únicamente `supabase/migrate_v1_1.sql` desde SQL Editor después de hacer una copia de seguridad.

1. Comprueba que el administrador actual tenga `admin` en `user_roles` (el script migra `profiles.role` si faltara).
2. Ejecuta `supabase/migrate_v1_1.sql`.
3. En **Authentication → Providers → Email**, desactiva **Allow new users to sign up**. Esta versión retira el formulario público de registro; la creación de cuentas se hace en **Authentication → Users → Add user**. No se crean contraseñas desde React.
4. Inicia sesión como administrador. En **Usuarios y permisos** pulsa **Actualizar**, edita el username y asigna roles mediante casillas. Si creas un usuario desde Authentication, el trigger le asigna inicialmente `seller` y un username temporal; puedes cambiarlos desde el panel.
5. Roles: `admin` administra usuarios y productos y cambia producción; `seller` registra pedidos y ve los suyos; `production` ve pedidos y cambia estados; `billing` y `supervisor` pueden consultar todos los pedidos, sin editar estados. Los roles son acumulativos.
6. Mantén `profiles.role` mientras haya dependencias heredadas; el acceso V1.1 se basa en `user_roles`.

**Seguridad:** Supabase Auth continúa iniciando sesión con **correo y contraseña**; `username` es un identificador único para mostrar/gestionar usuarios, no credencial de inicio de sesión. Las claves secretas nunca deben incluirse en el frontend. El SQL contiene RLS y triggers de protección, pero **debe probarse en un entorno de pruebas antes de datos reales**. Los usuarios con roles de facturación/supervisor tienen acceso de lectura a datos de pedidos y clientes: revisa si es adecuado para tu operación.

**Limitación:** la creación de usuarios todavía se realiza desde Supabase Authentication (no desde el panel React); para crear cuentas desde la app se necesitará una Edge Function protegida que use la API administrativa en el servidor. No publiques `service_role` en el navegador.

## V1.2 — Inicio de sesión con username (sin correo en la interfaz)

Esta versión **requiere desplegar una Supabase Edge Function**: el correo se conserva
internamente en Supabase Auth, pero el usuario inicia sesión con `username` y contraseña.
El nombre de usuario debe estar asignado en `public.profiles.username`.

1. Instala Supabase CLI, inicia sesión y vincula el proyecto:
   `supabase login`
   `supabase link --project-ref TU_PROJECT_REF`
2. Configura la URL de origen exacta del frontend (sin `/` al final), por ejemplo
   `https://TU_USUARIO.github.io`, en los secretos de Edge Functions:
   `supabase secrets set ALLOWED_ORIGIN=https://TU_USUARIO.github.io`
   Para pruebas locales, cambia temporalmente a `http://localhost:5173`.
   Para permitir ambos orígenes, adapta el código a una lista de orígenes permitidos.
3. Despliega la función pública de inicio de sesión:
   `supabase functions deploy login-username --no-verify-jwt`
4. Supabase provee automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` a la función. **Nunca coloques SERVICE_ROLE_KEY
   en `.env` de Vite ni en GitHub Pages.**
5. Ejecuta `supabase/username_login_checks.sql` y comprueba que los usuarios
   tengan un username único y válido. Luego inicia la aplicación (`npm run dev`).

**Seguridad antes de producción:** aplica limitación de intentos por IP/usuario
en el servidor o en un gateway, monitoriza intentos fallidos y utiliza contraseñas
fuertes. CORS limita el acceso desde navegadores, pero no sustituye el rate limiting.
No habilites el registro público. La función responde con errores genéricos para
no confirmar si existe un username. No despliegues la función sin controlar abusos.

## V1.3 — Registro de usuarios desde el administrador

- Se agregó el formulario **Usuarios y roles → Registrar nuevo usuario**.
- Solo una sesión válida con rol `admin` y perfil activo puede crear cuentas.
- El correo es necesario para recuperación de cuenta, **no para iniciar sesión**.
- Username único por índice `LOWER(username)` de la base de datos.
- Se crean cuenta de Auth, perfil y roles. Ante un fallo al guardar perfil o roles, se intenta eliminar la cuenta recién creada. Revisa logs si una eliminación falla.

### Desplegar la nueva función

1. Confirma que `ALLOWED_ORIGIN` ya esté configurado para la URL exacta de React.
2. En Supabase CLI, vincula el proyecto y ejecuta:
   `supabase functions deploy create-user`.
3. La función **create-user debe tener Verify JWT activado** (a diferencia de `login-username`).
4. Mantén `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en secretos del servidor, nunca en Vite.
5. Ejecuta `npm install && npm run dev` y entra como administrador.

**Importante:** no ejecutes otra vez `schema.sql`. La función requiere que ya estén aplicadas
las migraciones de roles y las restricciones de username. Desactiva el registro público
si no lo necesitas. Antes de producción, implementa rate limiting, auditoría y un flujo
seguro para entregar contraseñas temporales y forzar su cambio. La función se entrega
como base funcional, no como sistema endurecido para producción.


## V1.4 — Login con Material UI
Se renovó exclusivamente la pantalla de inicio de sesión con MUI, Montserrat, fondo crema, botón degradado y visibilidad de contraseña. El flujo de autenticación por username y la Edge Function `login-username` no cambian. No requiere migraciones SQL. Ejecuta `npm install` y `npm run dev`. El icono 🦁 es temporal: sustituir por el archivo oficial del logo cuando esté disponible.
