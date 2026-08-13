import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sesion')?.value;

  if (token) {
    const sql = neon(process.env.DATABASE_URL);
    await sql`DELETE FROM sesiones WHERE token = ${token}`;
  }

  cookieStore.delete('sesion');
  return Response.json({ ok: true });
}