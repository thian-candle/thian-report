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
