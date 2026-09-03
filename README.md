# entregas-app

Registro fotográfico de entregas. Un operario saca una foto o un video con el
celular en el momento de la entrega, lo asocia a uno o varios clientes y a los
números de pedido correspondientes, y queda archivado y consultable.

Pensada para usarse desde el celular en la calle, con conexión mala o
intermitente: las capturas se encolan localmente y se suben solas cuando hay red.

## Stack

- **Next.js 16** (App Router) + React 19, JavaScript sin TypeScript
- **Tailwind CSS v4**
- **Neon** (Postgres serverless) para los datos
- **Vercel Blob** como destino inicial de la subida
- **Google Drive** como almacenamiento definitivo de los archivos
- Deploy en **Vercel**

## Cómo se guarda un archivo

El recorrido de una toma explica varias decisiones del código:

1. El navegador sube el archivo **directo a Vercel Blob**, sin pasar por el
   servidor (`/api/upload` sólo firma el token). Así no hay límite de tamaño de
   request ni timeout de función.
2. `POST /api/tomas` guarda la toma en Postgres, apuntando todavía al Blob.
3. Ya respondido el request, en un `after()`, el archivo se **copia a Drive** y
   se borra del Blob. Blob es caro como almacenamiento permanente; Drive no.
4. `archivo_url` pasa a apuntar a `/api/drive/[fileId]`, un proxy que baja el
   archivo de Drive con las credenciales del servidor.

Si el paso 3 falla, se reintenta unas veces. Si aun así falla, la toma queda
apuntando al Blob (no se pierde nada) y aparece un aviso en la pantalla de
estadísticas para que un admin lo vea.

**Los archivos son públicos para quien tenga el link.** El proxy no pide sesión
y el archivo en Drive queda con permiso "cualquiera con el link". Es
intencional: así el cliente puede abrir la toma que se le comparte por WhatsApp
sin tener usuario. La contracara es que el link no se puede revocar y sigue
funcionando aunque después se borre la toma.

## Roles

| Rol | Puede |
|---|---|
| `admin` | Todo: cargar, ver, borrar tomas, y administrar clientes y usuarios |
| `operario` | Cargar tomas y ver el visor y las estadísticas |
| `auditor` | Sólo ver: visor y estadísticas |

Los borrados son siempre lógicos (`eliminado_en`, `activo`): no se borra nada
de la base.

## Desarrollo

```bash
npm install
npm run dev
```

Hace falta un `.env.local` con:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a Neon |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `GOOGLE_CLIENT_ID` | OAuth de Drive |
| `GOOGLE_CLIENT_SECRET` | OAuth de Drive |
| `GOOGLE_REFRESH_TOKEN` | Cuenta de Drive dueña de los archivos |
| `APP_URL` | URL base con la que se arma `archivo_url` |

Un detalle que confunde en local: `archivo_url` se guarda como URL absoluta
usando `APP_URL`. Las tomas creadas en producción apuntan al dominio de
producción, así que abrirlas desde `localhost` sale a buscar el archivo allá.

## Base de datos

El esquema completo está en [`db/schema.sql`](db/schema.sql), que sirve para
crear la base desde cero y para leer el modelo de un vistazo.

Los cambios sobre una base con datos van como scripts en `scripts/`, uno por
migración, pensados para correrse una sola vez y ser idempotentes:

```bash
node scripts/migrar-activo-clientes.js
```

Crear un usuario (no hay alta pública ni registro):

```bash
node scripts/crear-usuario.js "Nombre Apellido" mail@ejemplo.com contraseña admin
```

## Estado

En producción y en uso. Sin tests automatizados: los cambios se verifican a mano
y con `npm run lint`.
