// Migración aditiva: agrega columna `activo` a `clientes` (default true). No borra ni modifica datos existentes.
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true`;
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM clientes WHERE activo = true`;
  console.log(`Columna 'activo' lista. Clientes activos: ${count}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
