import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

const ROLES_VALIDOS = ['admin', 'operario', 'auditor'];

export async function PATCH(request, { params }) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const usuarioId = Number(id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return Response.json({ ok: false, error: 'Id inválido' }, { status: 400 });
  }

  const { rol, activo, password } = await request.json();
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (rol !== undefined) {
      if (!ROLES_VALIDOS.includes(rol)) {
        return Response.json({ ok: false, error: 'Rol inválido' }, { status: 400 });
      }
      await sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${usuarioId}`;
    }

    if (activo !== undefined) {
      await sql`UPDATE usuarios SET activo = ${activo} WHERE id = ${usuarioId}`;
      if (!activo) {
        await sql`DELETE FROM sesiones WHERE usuario_id = ${usuarioId}`;
      }
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return Response.json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      }
      const hash = await bcrypt.hash(password, 10);
      await sql`UPDATE usuarios SET password_hash = ${hash} WHERE id = ${usuarioId}`;
      await sql`DELETE FROM sesiones WHERE usuario_id = ${usuarioId}`;
    }

    const [actualizado] = await sql`
      SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE id = ${usuarioId}
    `;
    if (!actualizado) {
      return Response.json({ ok: false, error: 'No encontrado' }, { status: 404 });
    }
    return Response.json({ ok: true, usuario: actualizado });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
