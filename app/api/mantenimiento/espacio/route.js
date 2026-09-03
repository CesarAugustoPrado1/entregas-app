import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { liberarEspacio, UMBRAL_BYTES } from '@/lib/autoborrado';

export const maxDuration = 60;

const GB = 1024 ** 3;

function resumir(resultado) {
  return {
    ...resultado,
    usadoGB: Number((resultado.usadoBytes / GB).toFixed(2)),
    umbralGB: Number((resultado.umbralBytes / GB).toFixed(2)),
    liberadoGB: Number((resultado.bytesLiberados / GB).toFixed(2)),
    borradas: resultado.borradas.map((b) => ({
      id: b.id,
      fecha: new Date(b.fechaHora).toISOString().slice(0, 10),
      mb: b.tamanoBytes ? Number((b.tamanoBytes / 1024 ** 2).toFixed(1)) : null,
      yaEliminada: b.yaEliminada,
    })),
  };
}

// Simulación: no borra nada. Acepta bajar el umbral con ?umbral_gb= para poder ver
// qué haría el autoborrado sin tener que esperar a que Drive se llene de verdad.
export async function GET(request) {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const umbralGb = Number(searchParams.get('umbral_gb'));
  const umbralBytes = umbralGb > 0 ? umbralGb * GB : UMBRAL_BYTES;

  try {
    const resultado = await liberarEspacio({ simular: true, umbralBytes });
    return Response.json({ ok: true, ...resumir(resultado) });
  } catch (error) {
    console.error('Error al simular la liberación de espacio:', error.message);
    return Response.json({ ok: false, error: 'No se pudo simular' }, { status: 500 });
  }
}

// Corrida real, para forzar el barrido a mano sin esperar a la próxima carga.
// A propósito NO acepta umbral: siempre usa el de producción, así que no puede
// borrar más de lo que borraría el automático. Bajar el umbral sólo se puede
// simulando.
export async function POST() {
  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin'])) {
    return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const resultado = await liberarEspacio();
    return Response.json({ ok: true, ...resumir(resultado) });
  } catch (error) {
    console.error('Error al liberar espacio:', error.message);
    return Response.json({ ok: false, error: 'No se pudo liberar espacio' }, { status: 500 });
  }
}
