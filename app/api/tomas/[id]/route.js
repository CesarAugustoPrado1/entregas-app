import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

export async function DELETE(request, { params }) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const tomaId = Number(id);
  if (!Number.isInteger(tomaId) || tomaId <= 0) {
    return Response.json({ ok: false, error: 'Id inválido' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [toma] = await sql`
      UPDATE tomas SET eliminado_en = now(), eliminado_por = ${usuario.id}
      WHERE id = ${tomaId} AND eliminado_en IS NULL
      RETURNING id
    `;
    if (!toma) {
      return Response.json({ ok: false, error: 'No encontrada' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Error al eliminar la toma:', error.message);
    return Response.json({ ok: false, error: 'No se pudo eliminar la toma' }, { status: 500 });
  }
}
