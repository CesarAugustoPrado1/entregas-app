'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 40;

export default function VisorTomas({ esAdmin, tomasIniciales }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteSugerencias, setClienteSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const [pedido, setPedido] = useState('');

  const [tomas, setTomas] = useState(tomasIniciales);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hayMas, setHayMas] = useState(tomasIniciales.length === PAGE_SIZE);

  const [tomaAbierta, setTomaAbierta] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const debounceRef = useRef(null);
  const contenedorRef = useRef(null);

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
    if (!texto || texto.trim().length < 2) {
      setClienteSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    fetch(`/api/clientes?q=${encodeURIComponent(texto)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setClienteSugerencias(data.clientes || []);
          setMostrarSugerencias(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleClienteChange = (e) => {
    const val = e.target.value;
    setClienteQuery(val);
    setClienteSeleccionado(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarClientes(val), 300);
  };

  const elegirCliente = (c) => {
    setClienteSeleccionado(c);
    setClienteQuery(c.nombre);
    setMostrarSugerencias(false);
  };

  const limpiarCliente = () => {
    setClienteSeleccionado(null);
    setClienteQuery('');
  };

  const cargarTomas = async (nuevoOffset) => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', `${hasta}T23:59:59`);
      if (clienteSeleccionado) params.set('cliente_id', clienteSeleccionado.id);
      if (pedido.trim()) params.set('pedido', pedido.trim());
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(nuevoOffset));

      const res = await fetch(`/api/tomas?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudieron cargar las tomas');

      setTomas((prev) => (nuevoOffset === 0 ? data.tomas : [...prev, ...data.tomas]));
      setHayMas(data.tomas.length === PAGE_SIZE);
      setOffset(nuevoOffset);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las tomas');
    } finally {
      setCargando(false);
    }
  };

  const handleFiltroKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      cargarTomas(0);
    }
  };

  const eliminarToma = async (id) => {
    setEliminando(true);
    setError('');
    try {
      const res = await fetch(`/api/tomas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo eliminar');
      setTomas((prev) => prev.filter((t) => t.id !== id));
      setTomaAbierta(null);
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la toma');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold">Tomas guardadas</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Volver
          </Link>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4 mb-5 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div ref={contenedorRef} className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <input
              type="text"
              value={clienteQuery}
              onChange={handleClienteChange}
              onFocus={() => clienteSugerencias.length > 0 && setMostrarSugerencias(true)}
              placeholder="Todos"
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            {clienteSeleccionado && (
              <button
                type="button"
                onClick={limpiarCliente}
                className="absolute right-2 top-[30px] text-gray-400 text-sm leading-none"
              >
                ×
              </button>
            )}
            {mostrarSugerencias && clienteSugerencias.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                {clienteSugerencias.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => elegirCliente(c)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      {c.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">N° de pedido</label>
            <input
              type="text"
              inputMode="numeric"
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              placeholder="Ej: 4521"
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="sm:col-span-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
                limpiarCliente();
                setPedido('');
              }}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium"
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              onClick={() => cargarTomas(0)}
              disabled={cargando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Buscar
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">{error}</div>
        )}

        {/* Grilla */}
        {tomas.length === 0 && !cargando ? (
          <p className="text-center text-sm text-gray-400 mt-10">No hay tomas para estos filtros.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {tomas.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTomaAbierta(t)}
                className="bg-white rounded-lg shadow overflow-hidden text-left"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                  {t.tipo === 'video' ? (
                    <video src={t.archivo_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={t.archivo_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{t.cliente_nombre}</p>
                  <p className="text-[11px] text-gray-400 truncate">{t.pedidos.join(', ')}</p>
                  <p className="text-[11px] text-gray-400">{new Date(t.fecha_hora).toLocaleString('es-AR')}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {cargando && <p className="text-center text-sm text-gray-400 mt-4">Cargando...</p>}

        {hayMas && !cargando && (
          <div className="text-center mt-5">
            <button
              onClick={() => cargarTomas(offset + PAGE_SIZE)}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium"
            >
              Cargar más
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {tomaAbierta && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-20"
          onClick={() => setTomaAbierta(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black flex items-center justify-center">
              {tomaAbierta.tipo === 'video' ? (
                <video src={tomaAbierta.archivo_url} controls className="max-h-[60vh] w-full" />
              ) : (
                <img src={tomaAbierta.archivo_url} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm">
                <span className="text-gray-400">Cliente:</span> {tomaAbierta.cliente_nombre}
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Pedidos:</span> {tomaAbierta.pedidos.join(', ')}
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Fecha:</span>{' '}
                {new Date(tomaAbierta.fecha_hora).toLocaleString('es-AR')}
              </p>
              <p className="text-sm">
                <span className="text-gray-400">Cargado por:</span> {tomaAbierta.usuario_nombre}
              </p>
              {tomaAbierta.observaciones && (
                <p className="text-sm">
                  <span className="text-gray-400">Observaciones:</span> {tomaAbierta.observaciones}
                </p>
              )}
              {tomaAbierta.drive_url && (
                <a
                  href={tomaAbierta.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline block"
                >
                  Ver respaldo en Drive
                </a>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTomaAbierta(null)}
                  className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cerrar
                </button>
                {esAdmin && (
                  <button
                    type="button"
                    disabled={eliminando}
                    onClick={() => eliminarToma(tomaAbierta.id)}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {eliminando ? 'Eliminando...' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
