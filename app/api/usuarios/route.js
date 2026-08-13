import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

const ROLES_VALIDOS = ['admin', 'operario', 'auditor'];

export async function GET() {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const usuarios = await sql`
    SELECT id, nombre, email, rol, activo, creado_en
    FROM usuarios
    ORDER BY creado_en DESC
  `;
  return Response.json({ ok: true, usuarios });
}

export async function POST(request) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { nombre, email, password, rol } = await request.json();

  if (!nombre || !email || !password || !rol) {
    return Response.json({ ok: false, error: 'Faltan datos obligatorios' }, { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return Response.json({ ok: false, error: 'Rol inválido' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const hash = await bcrypt.hash(password, 10);

  try {
    const [nuevo] = await sql`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (${nombre}, ${email}, ${hash}, ${rol})
      RETURNING id, nombre, email, rol, activo, creado_en
    `;
    return Response.json({ ok: true, usuario: nuevo });
  } catch (error) {
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return Response.json({ ok: false, error: 'Ya existe un usuario con ese email' }, { status: 400 });
    }
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
