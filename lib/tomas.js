import { neon } from '@neondatabase/serverless';

export async function listarTomas({ desde, hasta, clienteId, pedido, tipo, limit = 40, offset = 0 } = {}) {
  const condiciones = ['t.eliminado_en IS NULL'];
  const params = [];

  if (desde) {
    params.push(desde);
    condiciones.push(`t.fecha_hora >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta);
    condiciones.push(`t.fecha_hora <= $${params.length}`);
  }
  if (Number.isInteger(clienteId) && clienteId > 0) {
    params.push(clienteId);
    condiciones.push(
      `EXISTS (SELECT 1 FROM toma_clientes tc2 WHERE tc2.toma_id = t.id AND tc2.cliente_id = $${params.length})`
    );
  }
  if (['foto', 'video'].includes(tipo)) {
    params.push(tipo);
    condiciones.push(`t.tipo = $${params.length}`);
  }
  if (Number.isInteger(pedido) && pedido > 0) {
    params.push(pedido);
    condiciones.push(
      `EXISTS (SELECT 1 FROM toma_pedidos tp2 WHERE tp2.toma_id = t.id AND tp2.numero_pedido = $${params.length})`
    );
  }

  params.push(Math.min(Math.max(limit, 1), 100));
  const limitIdx = params.length;
  params.push(Math.max(offset, 0));
  const offsetIdx = params.length;

  const query = `
    SELECT t.id, t.fecha_hora, t.archivo_url, t.drive_url, t.tipo, t.observaciones, t.creado_en,
           t.archivo_borrado_en,
           u.nombre AS usuario_nombre,
           COALESCE(
             (
               SELECT json_agg(json_build_object('id', c.id, 'nombre', c.nombre) ORDER BY c.nombre)
               FROM toma_clientes tc
               JOIN clientes c ON c.id = tc.cliente_id
               WHERE tc.toma_id = t.id
             ),
             '[]'
           ) AS clientes,
           COALESCE(
             array_agg(tp.numero_pedido ORDER BY tp.numero_pedido) FILTER (WHERE tp.numero_pedido IS NOT NULL),
             '{}'
           ) AS pedidos
    FROM tomas t
    JOIN usuarios u ON u.id = t.usuario_id
    LEFT JOIN toma_pedidos tp ON tp.toma_id = t.id
    WHERE ${condiciones.join(' AND ')}
    GROUP BY t.id, u.nombre
    ORDER BY t.fecha_hora DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const sql = neon(process.env.DATABASE_URL);
  return sql.query(query, params);
}
