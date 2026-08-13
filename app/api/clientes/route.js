import { neon } from '@neondatabase/serverless';
import { getUsuarioActual } from '@/lib/auth';

export async function GET(request) {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  const sql = neon(process.env.DATABASE_URL);
  const clientes = await sql`
    SELECT id, nombre FROM clientes
    WHERE nombre ILIKE ${'%' + q + '%'}
    ORDER BY nombre
    LIMIT 8
  `;
  return Response.json({ ok: true, clientes });
}