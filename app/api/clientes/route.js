import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

export async function GET(request) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  const sql = neon(process.env.DATABASE_URL);
  try {
    const clientes = await sql`
      SELECT id, nombre FROM clientes
      WHERE nombre ILIKE ${'%' + q + '%'} AND activo = true
      ORDER BY nombre
      LIMIT 8
    `;
    return Response.json({ ok: true, clientes });
  } catch (error) {
    console.error('Error al buscar clientes:', error.message);
    return Response.json({ ok: false, error: 'No se pudieron buscar clientes' }, { status: 500 });
  }
}

export async function POST(request) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { nombre } = await request.json();
  if (!nombre || !nombre.trim()) {
    return Response.json({ ok: false, error: 'Falta el nombre del cliente' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [nuevo] = await sql`
      INSERT INTO clientes (nombre) VALUES (${nombre.trim()})
      RETURNING id, nombre, creado_en
    `;
    return Response.json({ ok: true, cliente: nuevo });
  } catch (error) {
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return Response.json({ ok: false, error: 'Ya existe un cliente con ese nombre' }, { status: 400 });
    }
    console.error('Error al crear cliente:', error.message);
    return Response.json({ ok: false, error: 'No se pudo crear el cliente' }, { status: 500 });
  }
}