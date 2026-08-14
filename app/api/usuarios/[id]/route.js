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

  if (rol !== undefined && !ROLES_VALIDOS.includes(rol)) {
    return Response.json({ ok: false, error: 'Rol inválido' }, { status: 400 });
  }
  if (password !== undefined && password.length < 6) {
    return Response.json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const dejaDeSerAdminActivo = (rol !== undefined && rol !== 'admin') || activo === false;
  if (dejaDeSerAdminActivo && usuarioId === usuario.id) {
    return Response.json({ ok: false, error: 'No podés cambiar tu propio rol ni desactivar tu cuenta' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (dejaDeSerAdminActivo) {
      const [objetivo] = await sql`SELECT rol, activo FROM usuarios WHERE id = ${usuarioId}`;
      if (!objetivo) {
        return Response.json({ ok: false, error: 'No encontrado' }, { status: 404 });
      }
      if (objetivo.rol === 'admin' && objetivo.activo) {
        const [{ count }] = await sql`
          SELECT COUNT(*)::int AS count FROM usuarios WHERE rol = 'admin' AND activo = true
        `;
        if (count <= 1) {
          return Response.json(
            { ok: false, error: 'No podés dejar el sistema sin ningún admin activo' },
            { status: 400 }
          );
        }
      }
    }

    if (rol !== undefined) {
      await sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${usuarioId}`;
    }

    if (activo !== undefined) {
      await sql`UPDATE usuarios SET activo = ${activo} WHERE id = ${usuarioId}`;
      if (!activo) {
        await sql`DELETE FROM sesiones WHERE usuario_id = ${usuarioId}`;
      }
    }

    if (password !== undefined) {
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
    console.error('Error al actualizar usuario:', error.message);
    return Response.json({ ok: false, error: 'No se pudo actualizar el usuario' }, { status: 500 });
  }
}
