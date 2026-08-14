'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useClienteAutocomplete } from '@/lib/useClienteAutocomplete';

const PAGE_SIZE = 40;

export default function VisorTomas({ esAdmin, tomasIniciales }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

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

  const [pedido, setPedido] = useState('');
  const [tipo, setTipo] = useState('');

  const [tomas, setTomas] = useState(tomasIniciales);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hayMas, setHayMas] = useState(tomasIniciales.length === PAGE_SIZE);

  const [tomaAbierta, setTomaAbierta] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

  const [seleccionActiva, setSeleccionActiva] = useState(false);
  const [seleccionados, setSeleccionados] = useState(() => new Set());

  const cargarTomas = async (nuevoOffset) => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', `${hasta}T23:59:59`);
      if (clienteSeleccionado) params.set('cliente_id', clienteSeleccionado.id);
      if (pedido.trim()) params.set('pedido', pedido.trim());
      if (tipo) params.set('tipo', tipo);
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

  const textoToma = (t) =>
    `Cliente: ${t.cliente_nombre}\nPedidos: ${t.pedidos.join(', ')}\nFecha: ${new Date(t.fecha_hora).toLocaleString('es-AR')}\n${t.archivo_url}`;

  const archivoDeToma = async (t) => {
    const res = await fetch(t.archivo_url);
    const blob = await res.blob();
    const ext = t.tipo === 'video' ? 'mp4' : 'jpg';
    return new File([blob], `toma-${t.id}.${ext}`, { type: blob.type });
  };

  const compartirToma = async (t) => {
    setError('');
    setCompartiendo(true);
    try {
      if (navigator.canShare) {
        const archivo = await archivoDeToma(t);
        if (navigator.canShare({ files: [archivo] })) {
          await navigator.share({ files: [archivo], title: `Toma - ${t.cliente_nombre}`, text: textoToma(t) });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: `Toma - ${t.cliente_nombre}`, text: textoToma(t) });
      } else {
        setError('Tu navegador no soporta compartir directo. Usá los botones de WhatsApp o email.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('No se pudo compartir el archivo. Usá los botones de WhatsApp o email.');
      }
    } finally {
      setCompartiendo(false);
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelarSeleccion = () => {
    setSeleccionActiva(false);
    setSeleccionados(new Set());
  };

  const compartirSeleccionados = async () => {
    setError('');
    const elegidas = tomas.filter((t) => seleccionados.has(t.id));
    if (elegidas.length === 0) return;

    setCompartiendo(true);
    try {
      if (navigator.canShare) {
        const archivos = await Promise.all(elegidas.map(archivoDeToma));
        if (navigator.canShare({ files: archivos })) {
          await navigator.share({ files: archivos, title: 'Tomas seleccionadas' });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: 'Tomas seleccionadas', text: elegidas.map(textoToma).join('\n\n') });
      } else {
        setError('Tu navegador no soporta compartir directo. Abrí cada toma y usá los botones de WhatsApp o email.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('No se pudo compartir. Abrí cada toma y usá los botones de WhatsApp o email.');
      }
    } finally {
      setCompartiendo(false);
    }
  };

  const cerrarModal = () => {
    setTomaAbierta(null);
    setConfirmarEliminar(false);
  };

  const eliminarToma = async (id) => {
    setEliminando(true);
    setError('');
    try {
      const res = await fetch(`/api/tomas/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo eliminar');
      setTomas((prev) => prev.filter((t) => t.id !== id));
      setSeleccionados((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      cerrarModal();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la toma');
      setConfirmarEliminar(false);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Tomas guardadas</h1>
          <div className="flex items-center gap-3">
            {tomas.length > 0 && (
              <button
                type="button"
                onClick={() => (seleccionActiva ? cancelarSeleccion() : setSeleccionActiva(true))}
                className="text-sm text-blue-600 hover:underline"
              >
                {seleccionActiva ? 'Cancelar selección' : 'Seleccionar'}
              </button>
            )}
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              Volver
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-4 mb-5 grid gap-3 sm:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div ref={contenedorClienteRef} className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
            <input
              type="text"
              value={cliente.query}
              onChange={cliente.handleChange}
              onFocus={() => cliente.sugerencias.length > 0 && cliente.setMostrarSugerencias(true)}
              placeholder="Todos"
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
            {clienteSeleccionado && (
              <button
                type="button"
                onClick={cliente.limpiar}
                className="absolute right-2 top-[30px] text-gray-700 text-sm leading-none"
              >
                ×
              </button>
            )}
            {cliente.mostrarSugerencias && cliente.sugerencias.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                {cliente.sugerencias.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => cliente.elegir(c)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      {c.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cliente.errorBusqueda && <p className="text-xs text-red-600 mt-1">{cliente.errorBusqueda}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">N° de pedido</label>
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Foto y video</option>
              <option value="foto">Solo foto</option>
              <option value="video">Solo video</option>
            </select>
          </div>
          <div className="sm:col-span-5 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
                cliente.limpiar();
                setPedido('');
                setTipo('');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
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

        {error && !tomaAbierta && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">{error}</div>
        )}

        {/* Grilla */}
        {tomas.length === 0 && !cargando ? (
          <p className="text-center text-sm text-gray-700 mt-10">No hay tomas para estos filtros.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {tomas.map((t) => {
              const seleccionada = seleccionados.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (seleccionActiva ? toggleSeleccion(t.id) : setTomaAbierta(t))}
                  className={`relative bg-white rounded-lg shadow overflow-hidden text-left ${
                    seleccionada ? 'ring-2 ring-blue-600' : ''
                  }`}
                >
                  {seleccionActiva && (
                    <span
                      className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
                        seleccionada ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/90 border-gray-400'
                      }`}
                    >
                      {seleccionada ? '✓' : ''}
                    </span>
                  )}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {t.tipo === 'video' ? (
                      <video src={t.archivo_url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={t.archivo_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate text-gray-900">{t.cliente_nombre}</p>
                    <p className="text-[11px] text-gray-700 truncate">{t.pedidos.join(', ')}</p>
                    <p className="text-[11px] text-gray-700">{new Date(t.fecha_hora).toLocaleString('es-AR')}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {cargando && <p className="text-center text-sm text-gray-700 mt-4">Cargando...</p>}

        {hayMas && !cargando && (
          <div className="text-center mt-5">
            <button
              onClick={() => cargarTomas(offset + PAGE_SIZE)}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
            >
              Cargar más
            </button>
          </div>
        )}

        {seleccionActiva && seleccionados.size > 0 && <div className="h-20" />}
      </div>

      {seleccionActiva && seleccionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 flex items-center justify-between gap-3 z-10">
          <p className="text-sm text-gray-800">
            {seleccionados.size} seleccionada{seleccionados.size !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={compartirSeleccionados}
              disabled={compartiendo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {compartiendo ? 'Preparando...' : 'Compartir'}
            </button>
            <button
              type="button"
              onClick={cancelarSeleccion}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {tomaAbierta && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-20"
          onClick={cerrarModal}
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
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 text-center">{error}</div>
              )}
              <p className="text-sm">
                <span className="text-gray-700">Cliente:</span> {tomaAbierta.cliente_nombre}
              </p>
              <p className="text-sm">
                <span className="text-gray-700">Pedidos:</span> {tomaAbierta.pedidos.join(', ')}
              </p>
              <p className="text-sm">
                <span className="text-gray-700">Fecha:</span>{' '}
                {new Date(tomaAbierta.fecha_hora).toLocaleString('es-AR')}
              </p>
              <p className="text-sm">
                <span className="text-gray-700">Cargado por:</span> {tomaAbierta.usuario_nombre}
              </p>
              {tomaAbierta.observaciones && (
                <p className="text-sm">
                  <span className="text-gray-700">Observaciones:</span> {tomaAbierta.observaciones}
                </p>
              )}
              {tomaAbierta.drive_url && (
                <a
                  href={tomaAbierta.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline block"
                >
                  Abrir en Drive
                </a>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={compartiendo}
                  onClick={() => compartirToma(tomaAbierta)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {compartiendo ? 'Preparando...' : 'Compartir'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(textoToma(tomaAbierta))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium text-center"
                >
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `Toma - ${tomaAbierta.cliente_nombre}`
                  )}&body=${encodeURIComponent(textoToma(tomaAbierta))}`}
                  className="flex-1 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium text-center"
                >
                  Email
                </a>
              </div>

              {confirmarEliminar ? (
                <div className="flex gap-2 pt-2">
                  <p className="flex-1 text-sm text-red-700 flex items-center">¿Eliminar esta toma?</p>
                  <button
                    type="button"
                    disabled={eliminando}
                    onClick={() => eliminarToma(tomaAbierta.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarEliminar(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="flex-1 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
                  >
                    Cerrar
                  </button>
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => setConfirmarEliminar(true)}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
