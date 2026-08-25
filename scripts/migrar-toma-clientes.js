// Migración aditiva: crea la tabla toma_clientes (relación N:N toma-cliente)
// y migra los datos existentes desde tomas.cliente_id. No borra ni modifica
// la columna tomas.cliente_id (se sigue usando como "cliente principal").
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS toma_clientes (
      toma_id integer NOT NULL REFERENCES tomas(id) ON DELETE CASCADE,
      cliente_id integer NOT NULL REFERENCES clientes(id),
      PRIMARY KEY (toma_id, cliente_id)
    )
  `;

  await sql`
    INSERT INTO toma_clientes (toma_id, cliente_id)
    SELECT id, cliente_id FROM tomas WHERE cliente_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `;

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM toma_clientes`;
  console.log(`Tabla toma_clientes lista. Filas totales tras el backfill: ${count}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
