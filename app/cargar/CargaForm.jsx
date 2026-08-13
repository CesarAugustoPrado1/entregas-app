'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { upload } from '@vercel/blob/client';

export default function CargaForm() {
  const [query, setQuery] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [errorClientes, setErrorClientes] = useState('');

  const [pedidoActual, setPedidoActual] = useState('');
  const [pedidos, setPedidos] = useState([]);

  const [entregaActiva, setEntregaActiva] = useState(false);
  const [tomasGuardadas, setTomasGuardadas] = useState(0);

  const [archivo, setArchivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fechaHoraCaptura, setFechaHoraCaptura] = useState(null);

  const [observaciones, setObservaciones] = useState('');

  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const debounceRef = useRef(null);
  const contenedorRef = useRef(null);
  const fotoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const buscarClientes = useCallback((texto) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!texto || texto.trim().length < 2) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(texto)}`);
        const data = await res.json();
        if (!data.ok) {
          setErrorClientes(data.error || 'No se pudo buscar clientes');
          setSugerencias([]);
          setMostrarSugerencias(false);
          return;
        }
        setErrorClientes('');
        setSugerencias(data.clientes || []);
        setMostrarSugerencias(true);
      } catch (e) {
        setErrorClientes('No se pudo conectar para buscar clientes');
        setSugerencias([]);
        setMostrarSugerencias(false);
      }
    }, 300);
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setClienteSeleccionado(null);
    buscarClientes(val);
  };

  const elegirCliente = (c) => {
    setClienteSeleccionado(c);
    setQuery(c.nombre);
    setMostrarSugerencias(false);
  };

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

  const finalizarEntrega = () => {
    setClienteSeleccionado(null);
    setQuery('');
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

    const pedidosFinal = pedidosConPendiente();
    if (pedidosFinal.length === 0) {
      setError('Agregá al menos un número de pedido');
      return;
    }
    setPedidos(pedidosFinal);
    setPedidoActual('');

    setSubiendo(true);
    try {
      const tipo = archivo.type.startsWith('video/') ? 'video' : 'foto';
      const nombreArchivo = `${clienteSeleccionado.nombre}-${Date.now()}`;

      const blob = await upload(`tomas/${Date.now()}-${archivo.name}`, archivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      const res = await fetch('/api/tomas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado.id,
          pedidos: pedidosFinal,
          archivo_url: blob.url,
          tipo,
          observaciones,
          fecha_hora: fechaHoraCaptura.toISOString(),
          nombre_archivo: nombreArchivo,
          mime_type: archivo.type,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo guardar la toma');

      setTomasGuardadas((n) => n + 1);
      setExito(true);
      limpiarCaptura();
    } catch (err) {
      if (err.message?.includes('client token')) {
        setError('Tu sesión venció o no es válida. Volvé a iniciar sesión e intentá de nuevo.');
      } else {
        setError(err.message || 'No se pudo guardar la toma');
      }
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold mb-5 text-center text-gray-900">Cargar toma</h1>

        {exito && (
          <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">
            Toma guardada correctamente.
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">{error}</div>
        )}

        {!entregaActiva ? (
          <div className="bg-white rounded-xl shadow p-5 mb-4">
            {/* Cliente */}
            <div ref={contenedorRef} className="relative mb-4">
              <label className="block text-sm font-medium mb-1 text-gray-800">Cliente</label>
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                placeholder="Escribí para buscar..."
                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
              />
              {mostrarSugerencias && (
                <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                  {sugerencias.length > 0 ? (
                    sugerencias.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => elegirCliente(c)}
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
              {errorClientes && <p className="text-xs text-red-600 mt-1">{errorClientes}</p>}
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
                  className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={agregarPedido}
                  className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
                >
                  Agregar
                </button>
              </div>
              {pedidos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pedidos.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full pl-2.5 pr-1.5 py-1"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => quitarPedido(p)}
                        className="rounded-full hover:bg-blue-100 w-4 h-4 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-700">Cliente</p>
                <p className="text-sm font-medium text-gray-900">{clienteSeleccionado.nombre}</p>
              </div>
              <button
                type="button"
                onClick={finalizarEntrega}
                className="text-xs text-red-600 font-medium shrink-0"
              >
                Finalizar entrega
              </button>
            </div>

            <p className="text-xs text-gray-700 mb-1">Pedidos</p>
            {pedidos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pedidos.map((p) => (
                  <span
                    key={p}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full pl-2.5 pr-1.5 py-1"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => quitarPedido(p)}
                      className="rounded-full hover:bg-blue-100 w-4 h-4 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={pedidoActual}
                onChange={(e) => setPedidoActual(e.target.value)}
                onKeyDown={handlePedidoKeyDown}
                onBlur={agregarPedido}
                placeholder="Agregar otro pedido"
                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={agregarPedido}
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
              >
                +
              </button>
            </div>

            <p className="text-xs text-gray-700 mt-3">
              {tomasGuardadas} toma{tomasGuardadas !== 1 ? 's' : ''} guardada{tomasGuardadas !== 1 ? 's' : ''} en
              esta entrega
            </p>
          </div>
        )}

        {entregaActiva && (
          <div className="bg-white rounded-xl shadow p-5 mb-4">
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
                  className="border-2 border-dashed rounded-lg py-4 text-sm text-gray-700 font-medium"
                >
                  📷 Sacar foto
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg py-4 text-sm text-gray-700 font-medium"
                >
                  🎥 Grabar video
                </button>
              </div>

              {previewUrl && archivo && (
                <div className="mt-3">
                  {archivo.type.startsWith('video/') ? (
                    <video src={previewUrl} controls className="w-full rounded-lg max-h-64" />
                  ) : (
                    <img src={previewUrl} alt="Vista previa" className="w-full rounded-lg max-h-64 object-contain" />
                  )}
                  <p className="text-xs text-gray-700 mt-1">
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
                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        )}

        {!entregaActiva ? (
          <button
            onClick={iniciarEntrega}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium"
          >
            Iniciar entrega
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={guardarToma}
              disabled={subiendo || !archivo}
              className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
            >
              {subiendo ? 'Guardando...' : 'Guardar toma y sacar otra'}
            </button>
            <button
              type="button"
              onClick={finalizarEntrega}
              className="w-full bg-gray-100 text-gray-700 rounded-lg py-3 font-medium"
            >
              Finalizar entrega
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
