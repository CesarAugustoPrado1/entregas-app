import { neon } from '@neondatabase/serverless';
import { getAccessToken, borrarArchivoDeDrive, obtenerUsoDriveFresco } from './googleDrive';

const GB = 1024 ** 3;

// A partir de acá se empieza a liberar espacio. La cuenta de Drive tiene 15 GB
// (plan gratuito), así que quedan ~1 GB de aire por si algo falla.
export const UMBRAL_BYTES = 14 * GB;

// No se borra sólo lo justo para bajar del umbral: se baja medio giga por debajo.
// Si no, cada carga nueva volvería a pasar el umbral y dispararía otro borrado.
const MARGEN_BYTES = 0.5 * GB;

// Tope por corrida. El barrido corre después de responder el request, dentro del
// mismo presupuesto de 60s de la función, así que no puede ser ilimitado. Como
// corre en cada carga, si hace falta borrar más se completa en las siguientes.
const MAX_POR_CORRIDA = 40;

// Red de seguridad: nunca se toca nada más nuevo que esto, pase lo que pase con
// la cuota. Si un bug o una lectura rara de Drive dispara el barrido, que no se
// pueda llevar puesto el trabajo reciente.
const DIAS_PROTEGIDOS = 30;

/**
 * Borra de Drive los archivos más viejos hasta bajar del umbral de espacio.
 *
 * La fila de la toma NO se borra: se le marca archivo_borrado_en y se conserva
 * cliente, pedido, fecha y usuario. Lo que ocupa lugar es el archivo.
 *
 * Prioridad: primero las tomas que un admin ya borró de la app (su archivo es
 * peso muerto y no está protegido por la ventana de días), después las vivas
 * más viejas por fecha de captura.
 */
export async function liberarEspacio({ simular = false, umbralBytes = UMBRAL_BYTES } = {}) {
  const objetivoBytes = umbralBytes - MARGEN_BYTES;
  const { usadoBytes } = await obtenerUsoDriveFresco();

  if (usadoBytes < umbralBytes) {
    return { corrio: false, simulado: simular, usadoBytes, umbralBytes, borradas: [], bytesLiberados: 0 };
  }

  const bytesALiberar = usadoBytes - objetivoBytes;
  const sql = neon(process.env.DATABASE_URL);

  const candidatas = await sql`
    SELECT id, drive_file_id, tamano_bytes, fecha_hora, eliminado_en
    FROM tomas
    WHERE drive_file_id IS NOT NULL
      AND archivo_borrado_en IS NULL
      AND (eliminado_en IS NOT NULL OR fecha_hora < now() - make_interval(days => ${DIAS_PROTEGIDOS}))
    ORDER BY (eliminado_en IS NULL), fecha_hora ASC
    LIMIT ${MAX_POR_CORRIDA}
  `;

  if (candidatas.length === 0) {
    // Pasó el umbral pero no hay nada que se pueda borrar: o está todo dentro de
    // la ventana protegida, o ya se borró todo lo viejo. Hay que intervenir a mano.
    console.error(
      `AUTOBORRADO: Drive está en ${(usadoBytes / GB).toFixed(2)} GB (umbral ${(umbralBytes / GB).toFixed(2)} GB) ` +
        `pero no hay ninguna toma borrable: todo lo que queda es de los últimos ${DIAS_PROTEGIDOS} días.`
    );
    return {
      corrio: true, simulado: simular, usadoBytes, umbralBytes,
      borradas: [], bytesLiberados: 0, sinCandidatos: true,
    };
  }

  const accessToken = simular ? null : await getAccessToken();
  const borradas = [];
  let bytesLiberados = 0;

  for (const toma of candidatas) {
    if (bytesLiberados >= bytesALiberar) break;

    if (!simular) {
      try {
        await borrarArchivoDeDrive(toma.drive_file_id, accessToken);
        await sql`
          UPDATE tomas SET archivo_borrado_en = now()
          WHERE id = ${toma.id} AND archivo_borrado_en IS NULL
        `;
      } catch (error) {
        // Se sigue con la siguiente: un archivo que no se pudo borrar no tiene
        // por qué frenar la liberación de espacio.
        console.error(`AUTOBORRADO: no se pudo borrar el archivo de la toma ${toma.id}:`, error.message);
        continue;
      }
    }

    // Sin tamaño conocido cuenta 0: no se puede saber cuánto liberó. El tope por
    // corrida evita que eso derive en un borrado sin fin.
    bytesLiberados += Number(toma.tamano_bytes) || 0;
    borradas.push({
      id: toma.id,
      fechaHora: toma.fecha_hora,
      tamanoBytes: Number(toma.tamano_bytes) || null,
      yaEliminada: toma.eliminado_en !== null,
    });
  }

  if (!simular && borradas.length > 0) {
    const desde = borradas[0].fechaHora;
    const hasta = borradas[borradas.length - 1].fechaHora;
    console.log(
      `AUTOBORRADO: ${borradas.length} archivo(s) borrados de Drive, ` +
        `${(bytesLiberados / GB).toFixed(2)} GB liberados. ` +
        `Tomas del ${new Date(desde).toISOString().slice(0, 10)} al ${new Date(hasta).toISOString().slice(0, 10)}. ` +
        `Los registros se conservan.`
    );
  }

  return {
    corrio: true, simulado: simular, usadoBytes, umbralBytes,
    bytesALiberar, borradas, bytesLiberados,
    alcanzoObjetivo: bytesLiberados >= bytesALiberar,
  };
}
