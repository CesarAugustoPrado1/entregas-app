import { neon } from '@neondatabase/serverless';
import { del } from '@vercel/blob';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { after } from 'next/server';
import { copiarArchivoADriveConReintentos } from '@/lib/googleDrive';
import { liberarEspacio } from '@/lib/autoborrado';
import { listarTomas } from '@/lib/tomas';

export const maxDuration = 60;

export async function POST(request) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin', 'operario'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { cliente_ids, pedidos, archivo_url, tipo, observaciones, fecha_hora, nombre_archivo, mime_type } =
    await request.json();

  if (
    !Array.isArray(cliente_ids) ||
    cliente_ids.length === 0 ||
    !archivo_url ||
    !tipo ||
    !fecha_hora ||
    !Array.isArray(pedidos) ||
    pedidos.length === 0
  ) {
    return Response.json({ ok: false, error: 'Faltan datos obligatorios' }, { status: 400 });
  }
  if (!['foto', 'video'].includes(tipo)) {
    return Response.json({ ok: false, error: 'Tipo inválido' }, { status: 400 });
  }
  const clienteIdsNumeros = cliente_ids.map(Number);
  if (clienteIdsNumeros.some((n) => !Number.isInteger(n) || n <= 0)) {
    return Response.json({ ok: false, error: 'Clientes inválidos' }, { status: 400 });
  }
  const pedidosNumeros = pedidos.map(Number);
  if (pedidosNumeros.some((n) => !Number.isInteger(n) || n <= 0)) {
    return Response.json({ ok: false, error: 'Los números de pedido deben ser numéricos' }, { status: 400 });
  }

  // La cola de subidas puede reenviar una toma y el formulario permite repetir un valor,
  // así que se deduplica acá y no en la base (toma_pedidos no tiene índice único).
  const clientesUnicos = [...new Set(clienteIdsNumeros)];
  const pedidosUnicos = [...new Set(pedidosNumeros)];

  const sql = neon(process.env.DATABASE_URL);
  let tomaId;

  try {
    // Todo en un único statement: Postgres lo ejecuta como una sola transacción implícita,
    // así que no puede quedar una toma guardada a medias (sin pedidos o sin clientes) si
    // algo falla a mitad de camino. Los CTE que escriben corren siempre, aunque el SELECT
    // final no lea su resultado.
    //
    // tomas.cliente_id es una columna heredada del modelo viejo de un cliente por toma.
    // Sigue siendo NOT NULL en la base, así que se llena con el primero de la lista, pero
    // nadie la lee: los clientes reales de una toma están en toma_clientes.
    const [toma] = await sql`
      WITH nueva_toma AS (
        INSERT INTO tomas (fecha_hora, cliente_id, archivo_url, tipo, observaciones, usuario_id)
        VALUES (${fecha_hora}, ${clientesUnicos[0]}, ${archivo_url}, ${tipo}, ${observaciones || null}, ${usuario.id})
        RETURNING id
      ),
      ins_pedidos AS (
        INSERT INTO toma_pedidos (toma_id, numero_pedido)
        SELECT nueva_toma.id, p FROM nueva_toma, unnest(${pedidosUnicos}::int[]) AS p
      ),
      ins_clientes AS (
        INSERT INTO toma_clientes (toma_id, cliente_id)
        SELECT nueva_toma.id, c FROM nueva_toma, unnest(${clientesUnicos}::int[]) AS c
        ON CONFLICT DO NOTHING
      )
      SELECT id FROM nueva_toma
    `;
    tomaId = toma.id;
  } catch (error) {
    console.error('Error al guardar la toma:', error.message);
    return Response.json({ ok: false, error: 'No se pudo guardar la toma' }, { status: 500 });
  }

  after(async () => {
    const sql2 = neon(process.env.DATABASE_URL);
    let drive;
    try {
      drive = await copiarArchivoADriveConReintentos(archivo_url, nombre_archivo, mime_type);
    } catch (error) {
      // La toma queda apuntando al Blob, que no se borra: no se pierde nada, pero ocupa
      // storage y no está respaldada en Drive. Se detecta por drive_file_id IS NULL, que
      // es lo que cuenta la pantalla de estadísticas.
      console.error(`No se pudo copiar a Drive la toma ${tomaId} tras varios intentos:`, error.message);
      return;
    }

    const archivoProxy = `${process.env.APP_URL}/api/drive/${drive.id}`;

    try {
      await sql2`
        UPDATE tomas
        SET archivo_url = ${archivoProxy}, drive_url = ${drive.webViewLink}, drive_file_id = ${drive.id},
            tamano_bytes = ${drive.tamanoBytes}
        WHERE id = ${tomaId}
      `;
    } catch (error) {
      console.error(`Toma ${tomaId} copiada a Drive pero no se pudo actualizar la base:`, error.message);
      return;
    }

    try {
      await del(archivo_url);
    } catch (error) {
      console.error(`Toma ${tomaId} migrada a Drive pero no se pudo borrar el original de Blob:`, error.message);
    }

    // Recien despues de sumar el archivo nuevo se revisa si hay que hacer lugar.
    // Va aca, en el alta, porque el requisito es que nunca se deje de poder cargar
    // una toma por falta de espacio: se libera justo cuando entra material nuevo.
    try {
      await liberarEspacio();
    } catch (error) {
      console.error('No se pudo revisar el espacio en Drive:', error.message);
    }
  });

  return Response.json({ ok: true, id: tomaId });
}

export async function GET(request) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin', 'operario', 'auditor'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const clienteId = Number(searchParams.get('cliente_id'));
  const pedido = Number(searchParams.get('pedido'));
  const tipo = searchParams.get('tipo');
  const limit = Number(searchParams.get('limit')) || 40;
  const offset = Number(searchParams.get('offset')) || 0;

  try {
    const tomas = await listarTomas({ desde, hasta, clienteId, pedido, tipo, limit, offset });
    return Response.json({ ok: true, tomas });
  } catch (error) {
    console.error('Error al listar tomas:', error.message);
    return Response.json({ ok: false, error: 'No se pudieron cargar las tomas' }, { status: 500 });
  }
}
