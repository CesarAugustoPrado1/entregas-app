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

  const { activo, nombre } = await request.json();
  if (activo === undefined && nombre === undefined) {
    return Response.json({ ok: false, error: 'Nada para actualizar' }, { status: 400 });
  }
  if (nombre !== undefined && !nombre?.trim()) {
    return Response.json({ ok: false, error: 'El nombre no puede estar vacío' }, { status: 400 });
  }

  const nombreNuevo = nombre === undefined ? null : nombre.trim();
  const activoNuevo = activo === undefined ? null : activo;

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [actualizado] = await sql`
      UPDATE clientes
      SET nombre = COALESCE(${nombreNuevo}, nombre),
          activo = COALESCE(${activoNuevo}, activo)
      WHERE id = ${clienteId}
      RETURNING id, nombre, activo, creado_en
    `;
    if (!actualizado) {
      return Response.json({ ok: false, error: 'No encontrado' }, { status: 404 });
    }
    return Response.json({ ok: true, cliente: actualizado });
  } catch (error) {
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return Response.json({ ok: false, error: 'Ya existe un cliente con ese nombre' }, { status: 400 });
    }
    console.error('Error al actualizar cliente:', error.message);
    return Response.json({ ok: false, error: 'No se pudo actualizar el cliente' }, { status: 500 });
  }
}
