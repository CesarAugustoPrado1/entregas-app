'use client';
import { useState, useRef, useEffect } from 'react';
import { useClienteAutocomplete } from '@/lib/useClienteAutocomplete';
import { IconoFoto, IconoVideo } from '@/app/components/Iconos';
import { useCola } from '@/app/components/SincronizadorTomas';
import { PageHeader, Card, Button, Alert } from '@/app/components/ui';

const ANTIGUEDAD_MAXIMA_MS = 2 * 60 * 1000;

function ChipsPedidos({ pedidos, onQuitar, className = '' }) {
  if (pedidos.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {pedidos.map((p) => (
        <span
          key={p}
          className="flex items-center gap-1 bg-primary-50 text-primary-700 text-xs rounded-full pl-2.5 pr-1.5 py-1"
        >
          {p}
          <button
            type="button"
            onClick={() => onQuitar(p)}
            className="rounded-full hover:bg-primary-100 w-4 h-4 flex items-center justify-center"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export default function CargaForm() {
  const { encolar } = useCola();

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const cliente = useClienteAutocomplete({ onSeleccionar: setClienteSeleccionado });
  const { setMostrarSugerencias: cerrarSugerenciasCliente } = cliente;
  const contenedorClienteRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (contenedorClienteRef.current && !contenedorClienteRef.current.contains(e.target)) {
        cerrarSugerenciasCliente(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [cerrarSugerenciasCliente]);

  const [pedidoActual, setPedidoActual] = useState('');
  const [pedidos, setPedidos] = useState([]);

  const [entregaActiva, setEntregaActiva] = useState(false);
  const [tomasGuardadas, setTomasGuardadas] = useState(0);

  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fechaHoraCaptura, setFechaHoraCaptura] = useState(null);

  const [observaciones, setObservaciones] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const fotoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const agregarPedido = () => {
    const val = pedidoActual.trim();
    if (!val) return;
    if (!/^\d+$/.test(val)) {
      setError('El número de pedido solo puede tener dígitos');
      return;
    }
    if (pedidos.includes(val)) {
      setPedidoActual('');
      return;
    }
    setPedidos((p) => [...p, val]);
    setPedidoActual('');
    setError('');
  };

  const quitarPedido = (val) => {
    setPedidos((p) => p.filter((x) => x !== val));
  };

  const handlePedidoKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      agregarPedido();
    }
  };

  const pedidosConPendiente = () => {
    const val = pedidoActual.trim();
    if (val && /^\d+$/.test(val) && !pedidos.includes(val)) {
      return [...pedidos, val];
    }
    return pedidos;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const antiguedadMs = Date.now() - file.lastModified;
    if (file.lastModified && antiguedadMs > ANTIGUEDAD_MAXIMA_MS) {
      setError('Sacá la foto o el video ahora con la cámara; no se puede elegir un archivo existente.');
      e.target.value = '';
      return;
    }

    setError('');
    setArchivo(file);
    setFechaHoraCaptura(new Date());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const limpiarCaptura = () => {
    setArchivo(null);
    setPreviewUrl((actual) => {
      if (actual) URL.revokeObjectURL(actual);
      return null;
    });
    setFechaHoraCaptura(null);
    setObservaciones('');
  };

  const iniciarEntrega = () => {
    setError('');
    if (!clienteSeleccionado) {
      setError('Elegí un cliente de la lista');
      return;
    }
    const pedidosFinal = pedidosConPendiente();
    if (pedidosFinal.length === 0) {
      setError('Agregá al menos un número de pedido');
      return;
    }
    setPedidos(pedidosFinal);
    setPedidoActual('');
    setExito(false);
    setTomasGuardadas(0);
    setEntregaActiva(true);
  };

  // Encola la captura pendiente para subir en segundo plano. Devuelve true si se encoló (o si no había nada que encolar).
  const encolarTomaPendiente = async () => {
    if (!archivo) return true;

    const pedidosFinal = pedidosConPendiente();
    if (pedidosFinal.length === 0) {
      setError('Agregá al menos un número de pedido');
      return false;
    }
    setPedidos(pedidosFinal);
    setPedidoActual('');

    setGuardando(true);
    try {
      const tipo = archivo.type.startsWith('video/') ? 'video' : 'foto';
      const nombreArchivo = `${clienteSeleccionado.nombre}-${Date.now()}`;

      await encolar({
        archivo,
        tipo,
        mimeType: archivo.type,
        nombreArchivo,
        nombreOriginal: archivo.name,
        clienteId: clienteSeleccionado.id,
        clienteNombre: clienteSeleccionado.nombre,
        pedidos: pedidosFinal,
        observaciones,
        fechaHora: fechaHoraCaptura.toISOString(),
      });

      setTomasGuardadas((n) => n + 1);
      limpiarCaptura();
      return true;
    } catch (err) {
      setError(err.message || 'No se pudo guardar la toma en el dispositivo');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const finalizarEntrega = async () => {
    setError('');
    setExito(false);

    const guardada = await encolarTomaPendiente();
    if (!guardada) return;

    setClienteSeleccionado(null);
    cliente.limpiar();
    setPedidos([]);
    setPedidoActual('');
    limpiarCaptura();
    setEntregaActiva(false);
    setTomasGuardadas(0);
    setExito(false);
    setError('');
  };

  const guardarToma = async () => {
    setError('');
    setExito(false);

    if (!archivo) {
      setError('Sacá una foto o un video');
      return;
    }

    const guardada = await encolarTomaPendiente();
    if (guardada) setExito(true);
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-md">
        <PageHeader title="Cargar toma" backHref="/" />

        {exito && <Alert tipo="success">Toma guardada en el dispositivo. Se sincroniza sola.</Alert>}
        {error && <Alert>{error}</Alert>}

        {!entregaActiva ? (
          <Card className="mb-4">
            {/* Cliente */}
            <div ref={contenedorClienteRef} className="relative mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-800">Cliente</label>
              <input
                type="text"
                value={cliente.query}
                onChange={cliente.handleChange}
                onFocus={() => cliente.sugerencias.length > 0 && cliente.setMostrarSugerencias(true)}
                placeholder="Escribí para buscar..."
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-400"
              />
              {cliente.mostrarSugerencias && (
                <ul className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                  {cliente.sugerencias.length > 0 ? (
                    cliente.sugerencias.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => cliente.elegir(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          {c.nombre}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-sm text-gray-700">
                      No se encontraron clientes con ese nombre
                    </li>
                  )}
                </ul>
              )}
              {cliente.errorBusqueda && <p className="text-xs text-red-600 mt-1">{cliente.errorBusqueda}</p>}
              {clienteSeleccionado && (
                <p className="text-xs text-green-600 mt-1">✓ {clienteSeleccionado.nombre}</p>
              )}
            </div>

            {/* Pedidos */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Números de pedido</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pedidoActual}
                  onChange={(e) => setPedidoActual(e.target.value)}
                  onKeyDown={handlePedidoKeyDown}
                  onBlur={agregarPedido}
                  placeholder="Ej: 4521"
                  className="flex-1 border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-400"
                />
                <Button type="button" variant="ghost" onClick={agregarPedido}>
                  Agregar
                </Button>
              </div>
              <ChipsPedidos pedidos={pedidos} onQuitar={quitarPedido} className="mt-2" />
            </div>
          </Card>
        ) : (
          <Card className="mb-4" padding="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-muted">Cliente</p>
                <p className="text-sm font-medium text-gray-900">{clienteSeleccionado.nombre}</p>
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={finalizarEntrega}
                className="text-xs font-medium text-red-600 shrink-0 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Finalizar entrega'}
              </button>
            </div>

            <p className="text-xs text-muted mb-1">Pedidos</p>
            <ChipsPedidos pedidos={pedidos} onQuitar={quitarPedido} className="mb-2" />
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={pedidoActual}
                onChange={(e) => setPedidoActual(e.target.value)}
                onKeyDown={handlePedidoKeyDown}
                onBlur={agregarPedido}
                placeholder="Agregar otro pedido"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-400"
              />
              <Button type="button" variant="ghost" onClick={agregarPedido}>
                +
              </Button>
            </div>

            <p className="text-xs text-muted mt-3">
              {tomasGuardadas} toma{tomasGuardadas !== 1 ? 's' : ''} en cola de esta entrega
            </p>
          </Card>
        )}

        {entregaActiva && (
          <Card className="mb-4">
            {/* Foto / video */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-800">Foto o video</label>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 border-2 border-dashed border-border rounded-lg py-4 text-sm text-gray-700 font-medium hover:bg-primary-50 hover:border-primary-400 transition-colors"
                >
                  <IconoFoto className="w-7 h-7 text-primary-600" />
                  Sacar foto
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 border-2 border-dashed border-border rounded-lg py-4 text-sm text-gray-700 font-medium hover:bg-primary-50 hover:border-primary-400 transition-colors"
                >
                  <IconoVideo className="w-7 h-7 text-primary-600" />
                  Grabar video
                </button>
              </div>

              {previewUrl && archivo && (
                <div className="mt-3">
                  {archivo.type.startsWith('video/') ? (
                    <video src={previewUrl} controls className="w-full rounded-lg max-h-64" />
                  ) : (
                    <img src={previewUrl} alt="Vista previa" className="w-full rounded-lg max-h-64 object-contain" />
                  )}
                  <p className="text-xs text-muted mt-1">
                    Capturado: {fechaHoraCaptura?.toLocaleString('es-AR')}
                  </p>
                </div>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-800">Observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </Card>
        )}

        {!entregaActiva ? (
          <Button onClick={iniciarEntrega} className="w-full">
            Iniciar entrega
          </Button>
        ) : (
          <div className="space-y-2">
            <Button onClick={guardarToma} disabled={guardando || !archivo} className="w-full">
              {guardando ? 'Guardando...' : 'Guardar toma y sacar otra'}
            </Button>
            <Button type="button" variant="ghost" disabled={guardando} onClick={finalizarEntrega} className="w-full">
              {guardando ? 'Guardando...' : 'Finalizar entrega'}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
