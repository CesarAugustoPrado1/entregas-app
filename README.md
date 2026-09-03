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

## Autoborrado por espacio

La cuenta de Drive tiene 15 GB. Al ritmo actual (~2 GB/mes) eso da unos 6 meses
de registros, y el requisito es que **nunca** se deje de poder cargar una toma
nueva por falta de lugar: una foto nueva vale más que una muy vieja.

Cuando Drive pasa de **14 GB**, después de cada carga se borran los archivos más
viejos hasta bajar a 13,5 GB. El medio giga de margen evita que cada carga
posterior vuelva a disparar el barrido.

Lo que se borra es **el archivo, no el registro**. La fila de la toma queda con
`archivo_borrado_en` marcado, así que seguís sabiendo qué se entregó, a quién,
cuándo y quién lo cargó; lo único que se pierde es la foto. El visor las muestra
como "archivo borrado por espacio".

Orden de borrado: primero las tomas que un admin ya eliminó de la app (su
archivo es peso muerto), después las vivas más viejas por fecha de captura.

Tres frenos, porque es un borrado automático e irreversible:

- Nunca se toca nada de los **últimos 30 días**, pase lo que pase con la cuota
- Como máximo **40 archivos por corrida** (si hace falta más, sigue en la próxima carga)
- Nunca se borra más de lo necesario para llegar al objetivo

Si el umbral se supera y no hay nada borrable (todo es reciente), no se borra
nada y queda un error en los logs: ahí hay que intervenir a mano.

Para ver qué haría sin esperar a que Drive se llene, un admin puede simularlo
con un umbral más bajo:

```bash
curl -b "sesion=TU_TOKEN" "https://TU-APP/api/mantenimiento/espacio?umbral_gb=1"
```

Ese `GET` no borra nada nunca. El `POST` al mismo endpoint fuerza una corrida
real, pero siempre con el umbral de producción: no acepta bajarlo.

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
