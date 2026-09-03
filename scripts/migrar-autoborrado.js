// Migración aditiva para el autoborrado por espacio. No borra ni modifica datos.
//
//   tomas.archivo_borrado_en  cuándo se borró el archivo de Drive para liberar
//                             espacio. NULL = el archivo sigue estando. La fila
//                             (cliente, pedido, fecha, usuario) se conserva
//                             siempre: lo que ocupa lugar es el archivo.
//   tomas.tamano_bytes        tamaño del archivo en Drive. Se guarda al subir
//                             para poder calcular cuánto libera cada borrado sin
//                             preguntarle a Drive archivo por archivo.
//
// Para las tomas que ya existen, el tamaño se trae de Drive (backfill). Es
// idempotente: se puede correr de nuevo sin problema.
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener el token de Drive: ' + JSON.stringify(data));
  return data.access_token;
}

async function main() {
  await sql`ALTER TABLE tomas ADD COLUMN IF NOT EXISTS archivo_borrado_en timestamptz`;
  await sql`ALTER TABLE tomas ADD COLUMN IF NOT EXISTS tamano_bytes bigint`;
  console.log('Columnas archivo_borrado_en y tamano_bytes listas.');

  const pendientes = await sql`
    SELECT id, drive_file_id FROM tomas
    WHERE drive_file_id IS NOT NULL AND tamano_bytes IS NULL AND archivo_borrado_en IS NULL
    ORDER BY id
  `;

  if (pendientes.length === 0) {
    console.log('No hay tomas a las que completarles el tamaño.');
    return;
  }

  console.log(`Consultando a Drive el tamaño de ${pendientes.length} archivo(s)...`);
  const accessToken = await getAccessToken();
  let ok = 0;
  let fallados = 0;

  for (const toma of pendientes) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${toma.drive_file_id}?fields=size`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!data.size) throw new Error(JSON.stringify(data.error || data));
      await sql`UPDATE tomas SET tamano_bytes = ${Number(data.size)} WHERE id = ${toma.id}`;
      ok++;
      if (ok % 50 === 0) console.log(`  ${ok}/${pendientes.length}...`);
    } catch (error) {
      fallados++;
      console.error(`  toma ${toma.id}: no se pudo obtener el tamaño (${error.message})`);
    }
  }

  console.log(`Backfill terminado: ${ok} con tamaño, ${fallados} sin resolver.`);
  if (fallados > 0) {
    console.log('Las que fallaron quedan con tamano_bytes en NULL; el autoborrado las');
    console.log('cuenta como 0 bytes liberados, así que conviene volver a correr esto.');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
