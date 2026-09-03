// Saca la columna deprecada tomas.cliente_id, que quedó del modelo viejo de un
// cliente por toma. Hoy ninguna consulta la lee: los clientes de una toma están
// en toma_clientes. Sólo se sigue escribiendo porque es NOT NULL.
//
// El orden importa, porque la app y la base tienen que quedar compatibles en cada
// paso intermedio:
//
//   1. node scripts/migrar-quitar-cliente-id.js --paso1
//        ALTER ... DROP NOT NULL. No borra nada y no rompe la app actual.
//        A partir de acá la app puede insertar tomas sin la columna.
//
//   2. Sacar cliente_id del INSERT en app/api/tomas/route.js y deployar.
//        (Si hacés esto ANTES del paso 1, se rompe el alta de tomas: violación
//        de NOT NULL en cada carga.)
//
//   3. node scripts/migrar-quitar-cliente-id.js --paso2
//        DROP COLUMN. Esto sí es destructivo e irreversible.
//
// El paso 2 verifica antes que toma_clientes cubra todas las tomas, para no
// tirar datos que no estén replicados.
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function paso1() {
  await sql`ALTER TABLE tomas ALTER COLUMN cliente_id DROP NOT NULL`;
  console.log('Listo: tomas.cliente_id ya no es NOT NULL.');
  console.log('Ahora podés sacarla del INSERT en app/api/tomas/route.js y deployar.');
  console.log('Para revertir: ALTER TABLE tomas ALTER COLUMN cliente_id SET NOT NULL');
  console.log('(sólo funciona mientras ninguna fila la tenga en NULL).');
}

async function paso2() {
  const [{ huerfanas }] = await sql`
    SELECT count(*)::int AS huerfanas
    FROM tomas t
    WHERE t.cliente_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM toma_clientes tc
        WHERE tc.toma_id = t.id AND tc.cliente_id = t.cliente_id
      )
  `;

  if (huerfanas > 0) {
    console.error(`ABORTADO: ${huerfanas} toma(s) tienen un cliente_id que no está en toma_clientes.`);
    console.error('Corré primero scripts/migrar-toma-clientes.js para replicar esos datos.');
    process.exit(1);
  }

  const [{ nulls }] = await sql`SELECT count(*)::int AS nulls FROM tomas WHERE cliente_id IS NULL`;
  console.log(`Verificación OK: toma_clientes cubre todas las tomas (${nulls} ya sin cliente_id).`);

  await sql`ALTER TABLE tomas DROP COLUMN cliente_id`;
  console.log('Listo: columna tomas.cliente_id eliminada (y con ella el índice idx_tomas_cliente).');
  console.log('Acordate de actualizar db/schema.sql.');
}

async function main() {
  const flag = process.argv[2];
  if (flag === '--paso1') return paso1();
  if (flag === '--paso2') return paso2();

  console.log('Uso: node scripts/migrar-quitar-cliente-id.js --paso1 | --paso2');
  console.log('Leé el comentario de arriba del archivo: el orden importa.');
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
