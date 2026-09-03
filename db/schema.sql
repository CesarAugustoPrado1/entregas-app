-- Esquema de la base de entregas-app (Neon Postgres).
--
-- Este archivo es la fuente de verdad del esquema y refleja el estado real de
-- producción. Hasta ahora el esquema sólo existía dentro de Neon: si había que
-- recrear la base desde cero, no había de dónde sacarlo.
--
-- Las migraciones sobre una base que ya tiene datos siguen viviendo en scripts/,
-- una por cambio. Este archivo es para crear la base desde cero (entorno nuevo,
-- copia de desarrollo) y para leer el modelo de un vistazo.
--
-- Recrear desde cero:  psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE usuarios (
  id            serial PRIMARY KEY,
  nombre        text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,                 -- bcrypt, ver scripts/crear-usuario.js
  rol           text NOT NULL CHECK (rol IN ('admin', 'operario', 'auditor')),
  activo        boolean NOT NULL DEFAULT true, -- baja lógica: no se borran usuarios
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Sesiones por token opaco guardado en la cookie httpOnly 'sesion'.
-- No hay barrido de sesiones vencidas: getUsuarioActual() las descarta por fecha,
-- pero las filas quedan en la tabla.
CREATE TABLE sesiones (
  token      text PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  expira_en  timestamptz NOT NULL
);

CREATE TABLE clientes (
  id        serial PRIMARY KEY,
  nombre    text NOT NULL UNIQUE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  activo    boolean NOT NULL DEFAULT true  -- baja lógica
);

-- Una toma es una foto o un video sacado en el momento de una entrega.
--
-- El archivo vive en Google Drive y se sirve por el proxy /api/drive/[fileId];
-- archivo_url apunta a ese proxy. Mientras la copia a Drive está pendiente (o si
-- falló), archivo_url todavía apunta al Blob de Vercel y drive_file_id es NULL.
CREATE TABLE tomas (
  id            serial PRIMARY KEY,
  fecha_hora    timestamptz NOT NULL,  -- momento de la captura, no del alta
  cliente_id    integer NOT NULL REFERENCES clientes(id),
  archivo_url   text NOT NULL,
  drive_file_id text,
  drive_url     text,                  -- webViewLink de Drive, para "Abrir en Drive"
  tipo          text NOT NULL CHECK (tipo IN ('foto', 'video')),
  observaciones text,
  usuario_id    integer NOT NULL REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  eliminado_en  timestamptz,           -- baja lógica; toda lectura filtra por IS NULL
  eliminado_por integer REFERENCES usuarios(id)
);

-- OJO: tomas.cliente_id está DEPRECADA.
--
-- Es la columna del modelo viejo de un cliente por toma. Desde que una toma puede
-- tener varios clientes, los clientes reales están en toma_clientes y ninguna
-- consulta lee esta columna: sólo se escribe, con el primer cliente de la lista,
-- porque sigue siendo NOT NULL. No la uses para saber de quién es una toma; da
-- una respuesta incompleta y silenciosamente equivocada.
--
-- Para sacarla: scripts/migrar-quitar-cliente-id.js
CREATE INDEX idx_tomas_cliente ON tomas (cliente_id);
CREATE INDEX idx_tomas_fecha ON tomas (fecha_hora);

-- Clientes de una toma (N:N). Reemplaza a tomas.cliente_id.
CREATE TABLE toma_clientes (
  toma_id    integer NOT NULL REFERENCES tomas(id) ON DELETE CASCADE,
  cliente_id integer NOT NULL REFERENCES clientes(id),
  PRIMARY KEY (toma_id, cliente_id)
);

-- Números de pedido asociados a una toma. Sin índice único: la deduplicación se
-- hace en la API antes de insertar (app/api/tomas/route.js).
CREATE TABLE toma_pedidos (
  id            serial PRIMARY KEY,
  toma_id       integer NOT NULL REFERENCES tomas(id) ON DELETE CASCADE,
  numero_pedido integer NOT NULL
);

CREATE INDEX idx_toma_pedidos_numero ON toma_pedidos (numero_pedido);
