import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ ok: false, error: 'Faltan datos' }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM usuarios WHERE email = ${email} AND activo = true`;
    const usuario = rows[0];

    if (!usuario) {
      return Response.json({ ok: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const valido = await bcrypt.compare(password, usuario.password_hash);
    if (!valido) {
      return Response.json({ ok: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await sql`INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (${token}, ${usuario.id}, ${expiraEn})`;

    const cookieStore = await cookies();
    cookieStore.set('sesion', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiraEn,
      path: '/',
    });

    return Response.json({ ok: true, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    return Response.json({ ok: false, error: 'No se pudo iniciar sesión' }, { status: 500 });
  }
}