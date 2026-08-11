import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [{ now }] = await sql`SELECT NOW() as now`;
    const tablas = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    return Response.json({
      ok: true,
      horaServidor: now,
      tablasEncontradas: tablas.map((t) => t.table_name),
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}