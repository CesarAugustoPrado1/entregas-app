import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

export async function PATCH(request, { params }) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return Response.json({ ok: false, error: 'Id inválido' }, { status: 400 });
  }

  const { activo } = await request.json();
  if (activo === undefined) {
    return Response.json({ ok: false, error: 'Nada para actualizar' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [actualizado] = await sql`
      UPDATE clientes SET activo = ${activo} WHERE id = ${clienteId}
      RETURNING id, nombre, activo, creado_en
    `;
    if (!actualizado) {
      return Response.json({ ok: false, error: 'No encontrado' }, { status: 404 });
    }
    return Response.json({ ok: true, cliente: actualizado });
  } catch (error) {
    console.error('Error al actualizar cliente:', error.message);
    return Response.json({ ok: false, error: 'No se pudo actualizar el cliente' }, { status: 500 });
  }
}
