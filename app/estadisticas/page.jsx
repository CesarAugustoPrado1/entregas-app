import { redirect } from 'next/navigation';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { obtenerEstadisticas } from '@/lib/estadisticas';
import { obtenerUsoDrive } from '@/lib/googleDrive';
import { PageHeader, Card, SinPermiso, Alert } from '@/app/components/ui';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(valor < 10 && i > 0 ? 1 : 0)} ${unidades[i]}`;
}

function formatDuracion(desde) {
  if (!desde) return '—';
  const inicio = new Date(desde);
  const ahora = new Date();
  let meses = (ahora.getFullYear() - inicio.getFullYear()) * 12 + (ahora.getMonth() - inicio.getMonth());
  if (ahora.getDate() < inicio.getDate()) meses--;
  meses = Math.max(meses, 0);

  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  if (anios > 0) {
    return `${anios} año${anios !== 1 ? 's' : ''}${
      mesesRestantes > 0 ? ` y ${mesesRestantes} mes${mesesRestantes !== 1 ? 'es' : ''}` : ''
    }`;
  }
  if (meses > 0) {
    return `${meses} mes${meses !== 1 ? 'es' : ''}`;
  }
  const dias = Math.max(Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)), 0);
  return `${dias} día${dias !== 1 ? 's' : ''}`;
}

function ultimosSeisMeses(porMes) {
  const mapa = new Map(porMes.map((m) => [new Date(m.mes).toISOString().slice(0, 7), m.cantidad]));
  const meses = [];
  const ahora = new Date();
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const clave = fecha.toISOString().slice(0, 7);
    meses.push({
      etiqueta: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      cantidad: mapa.get(clave) || 0,
    });
  }
  return meses;
}

function Tile({ etiqueta, valor }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted mb-1">{etiqueta}</p>
      <p className="text-xl font-semibold text-foreground tracking-tight">{valor}</p>
    </Card>
  );
}

export default async function EstadisticasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin', 'operario', 'auditor'])) {
    return <SinPermiso mensaje="No tenés permiso para ver las estadísticas." />;
  }

  const esAdmin = usuario.rol === 'admin';

  const [estadisticasResult, usoResult] = await Promise.allSettled([obtenerEstadisticas(), obtenerUsoDrive()]);

  const estadisticas =
    estadisticasResult.status === 'fulfilled'
      ? estadisticasResult.value
      : { fechaMasVieja: null, total: 0, fotos: 0, videos: 0, sinDrive: 0, porMes: [], topClientes: [], porUsuario: [] };
  const espacioBytes = usoResult.status === 'fulfilled' ? usoResult.value.usadoBytes : null;

  const meses = ultimosSeisMeses(estadisticas.porMes);
  const maxMes = Math.max(...meses.map((m) => m.cantidad), 1);
  const pctFotos = estadisticas.total > 0 ? Math.round((estadisticas.fotos / estadisticas.total) * 100) : 0;
  const pctVideos = 100 - pctFotos;

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <PageHeader title="Datos y estadísticas" backHref="/" />

        {esAdmin && estadisticas.sinDrive > 0 && (
          <Alert tipo="warning">
            {estadisticas.sinDrive} toma{estadisticas.sinDrive !== 1 ? 's' : ''} no se pudo copiar a Drive y sigue
            ocupando espacio en Blob. Revisá los logs del deploy.
          </Alert>
        )}

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-5">
          <Tile
            etiqueta="Toma más vieja guardada"
            valor={
              estadisticas.fechaMasVieja
                ? new Date(estadisticas.fechaMasVieja).toLocaleDateString('es-AR')
                : '—'
            }
          />
          <Tile etiqueta="Tiempo almacenado" valor={formatDuracion(estadisticas.fechaMasVieja)} />
          <Tile etiqueta="Espacio ocupado en Drive" valor={espacioBytes === null ? 'No disponible' : formatBytes(espacioBytes)} />
          <Tile etiqueta="Total de tomas" valor={estadisticas.total} />
        </div>

        <Card className="mb-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Foto vs. video</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-primary-500" style={{ width: `${pctFotos}%` }} />
            <div className="bg-primary-100" style={{ width: `${pctVideos}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted mt-2">
            <span>Fotos: {estadisticas.fotos} ({pctFotos}%)</span>
            <span>Videos: {estadisticas.videos} ({pctVideos}%)</span>
          </div>
        </Card>

        <Card className="mb-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Tomas por mes</p>
          <div className="space-y-2">
            {meses.map((m) => (
              <div key={m.etiqueta} className="flex items-center gap-3">
                <span className="text-xs text-muted w-12 shrink-0">{m.etiqueta}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary-500 h-full rounded-full"
                    style={{ width: `${(m.cantidad / maxMes) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-700 w-6 text-right shrink-0">{m.cantidad}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold text-gray-900 mb-3">Top clientes</p>
            {estadisticas.topClientes.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay datos.</p>
            ) : (
              <ul className="space-y-1.5">
                {estadisticas.topClientes.map((c) => (
                  <li key={c.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 truncate">{c.nombre}</span>
                    <span className="text-muted shrink-0 ml-2">{c.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <p className="text-sm font-semibold text-gray-900 mb-3">Tomas por usuario</p>
            {estadisticas.porUsuario.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay datos.</p>
            ) : (
              <ul className="space-y-1.5">
                {estadisticas.porUsuario.map((u) => (
                  <li key={u.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 truncate">{u.nombre}</span>
                    <span className="text-muted shrink-0 ml-2">{u.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
