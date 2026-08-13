import { cookies } from 'next/headers';
import { neon } from '@neondatabase/serverless';

export async function getUsuarioActual() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sesion')?.value;
  if (!token) return null;

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT u.id, u.nombre, u.email, u.rol, u.activo, s.expira_en
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ${token}
  `;
  const row = rows[0];
  if (!row) return null;
  if (!row.activo) return null;
  if (new Date(row.expira_en) < new Date()) return null;

  return { id: row.id, nombre: row.nombre, email: row.email, rol: row.rol };
}

export function requiereRol(usuario, rolesPermitidos) {
  if (!usuario) return false;
  return rolesPermitidos.includes(usuario.rol);
}