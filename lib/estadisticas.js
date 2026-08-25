import { neon } from '@neondatabase/serverless';
import { unstable_cache } from 'next/cache';

async function calcularEstadisticas() {
  const sql = neon(process.env.DATABASE_URL);

  const [[fechaRow], [totalesRow], porMes, topClientes, porUsuario] = await Promise.all([
    sql`SELECT MIN(fecha_hora) AS fecha_mas_vieja FROM tomas WHERE eliminado_en IS NULL`,
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE tipo = 'foto')::int AS fotos,
        COUNT(*) FILTER (WHERE tipo = 'video')::int AS videos
      FROM tomas
      WHERE eliminado_en IS NULL
    `,
    sql`
      SELECT date_trunc('month', fecha_hora) AS mes, COUNT(*)::int AS cantidad
      FROM tomas
      WHERE eliminado_en IS NULL AND fecha_hora >= date_trunc('month', now()) - interval '5 months'
      GROUP BY mes
      ORDER BY mes
    `,
    sql`
      SELECT c.id, c.nombre, COUNT(*)::int AS cantidad
      FROM tomas t
      JOIN clientes c ON c.id = t.cliente_id
      WHERE t.eliminado_en IS NULL
      GROUP BY c.id, c.nombre
      ORDER BY cantidad DESC
      LIMIT 5
    `,
    sql`
      SELECT u.id, u.nombre, COUNT(*)::int AS cantidad
      FROM tomas t
      JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.eliminado_en IS NULL
      GROUP BY u.id, u.nombre
      ORDER BY cantidad DESC
      LIMIT 5
    `,
  ]);

  return {
    fechaMasVieja: fechaRow?.fecha_mas_vieja || null,
    total: totalesRow?.total || 0,
    fotos: totalesRow?.fotos || 0,
    videos: totalesRow?.videos || 0,
    porMes,
    topClientes,
    porUsuario,
  };
}

// Estas consultas son iguales para todos los usuarios; se cachean 5 minutos
// para no repetirlas en cada apertura de la pantalla de estadísticas.
export const obtenerEstadisticas = unstable_cache(calcularEstadisticas, ['estadisticas'], {
  revalidate: 300,
});
