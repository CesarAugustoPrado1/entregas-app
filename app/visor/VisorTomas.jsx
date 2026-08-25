'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useClienteAutocomplete } from '@/lib/useClienteAutocomplete';
import { IconoFoto, IconoVideo, IconoChevronIzq, IconoChevronDer } from '@/app/components/Iconos';
import { PageHeader, Card, Button, Alert } from '@/app/components/ui';

const PAGE_SIZE = 40;

export default function VisorTomas({ esAdmin, puedeCargar, tomasIniciales }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const cliente = useClienteAutocomplete({ onSeleccionar: setClienteSeleccionado, incluirInactivos: true });
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
      return data.tomas;
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las tomas');
      return [];
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

  const indiceTomaAbierta = tomaAbierta ? tomas.findIndex((t) => t.id === tomaAbierta.id) : -1;
  const hayAnterior = indiceTomaAbierta > 0;
  const haySiguiente = indiceTomaAbierta >= 0 && (indiceTomaAbierta < tomas.length - 1 || hayMas);

  const abrirToma = (t) => {
    setTomaAbierta(t);
    setConfirmarEliminar(false);
    setError('');
  };

  const abrirTomaPorIndice = (indice) => {
    if (indice < 0 || indice >= tomas.length) return;
    abrirToma(tomas[indice]);
  };

  const irAAnterior = () => abrirTomaPorIndice(indiceTomaAbierta - 1);

  const irASiguiente = async () => {
    if (indiceTomaAbierta < tomas.length - 1) {
      abrirTomaPorIndice(indiceTomaAbierta + 1);
      return;
    }
    if (!hayMas || cargando) return;
    const nuevas = await cargarTomas(offset + PAGE_SIZE);
    if (nuevas.length > 0) abrirToma(nuevas[0]);
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
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Tomas guardadas" backHref="/">
          {tomas.length > 0 && (
            <button
              type="button"
              onClick={() => (seleccionActiva ? cancelarSeleccion() : setSeleccionActiva(true))}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              {seleccionActiva ? 'Cancelar selección' : 'Seleccionar'}
            </button>
          )}
          {puedeCargar && (
            <Link href="/cargar" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Cargar toma
            </Link>
          )}
        </PageHeader>

        {/* Filtros */}
        <Card className="mb-5 grid gap-3 sm:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              onKeyDown={handleFiltroKeyDown}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
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
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
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
              <ul className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
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
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Foto y video</option>
              <option value="foto">Solo foto</option>
              <option value="video">Solo video</option>
            </select>
          </div>
          <div className="sm:col-span-5 flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDesde('');
                setHasta('');
                cliente.limpiar();
                setPedido('');
                setTipo('');
              }}
            >
              Limpiar filtros
            </Button>
            <Button type="button" onClick={() => cargarTomas(0)} disabled={cargando}>
              Buscar
            </Button>
          </div>
        </Card>

        {error && !tomaAbierta && <Alert>{error}</Alert>}

        {/* Grilla */}
        {tomas.length === 0 && !cargando ? (
          <p className="text-center text-sm text-muted mt-10">No hay tomas para estos filtros.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {tomas.map((t) => {
              const seleccionada = seleccionados.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (seleccionActiva ? toggleSeleccion(t.id) : abrirToma(t))}
                  className={`relative bg-surface rounded-xl shadow-sm ring-1 ring-border overflow-hidden text-left ${
                    seleccionada ? 'ring-2 ring-primary-600' : ''
                  }`}
                >
                  {seleccionActiva && (
                    <span
                      className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${
                        seleccionada ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white/90 border-gray-400'
                      }`}
                    >
                      {seleccionada ? '✓' : ''}
                    </span>
                  )}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden relative">
                    <span className="absolute top-1.5 right-1.5 z-10 bg-black/60 text-white rounded-full p-1">
                      {t.tipo === 'video' ? (
                        <IconoVideo className="w-3.5 h-3.5" />
                      ) : (
                        <IconoFoto className="w-3.5 h-3.5" />
                      )}
                    </span>
                    {t.tipo === 'video' ? (
                      <video src={t.archivo_url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={t.archivo_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate text-gray-900">{t.cliente_nombre}</p>
                    <p className="text-[11px] text-muted truncate">{t.pedidos.join(', ')}</p>
                    <p className="text-[11px] text-muted">{new Date(t.fecha_hora).toLocaleString('es-AR')}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {cargando && <p className="text-center text-sm text-muted mt-4">Cargando...</p>}

        {hayMas && !cargando && (
          <div className="text-center mt-5">
            <Button variant="ghost" onClick={() => cargarTomas(offset + PAGE_SIZE)}>
              Cargar más
            </Button>
          </div>
        )}

        {seleccionActiva && seleccionados.size > 0 && <div className="h-20" />}
      </div>

      {seleccionActiva && seleccionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border shadow-lg p-3 flex items-center justify-between gap-3 z-10">
          <p className="text-sm text-gray-800">
            {seleccionados.size} seleccionada{seleccionados.size !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button onClick={compartirSeleccionados} disabled={compartiendo}>
              {compartiendo ? 'Preparando...' : 'Compartir'}
            </Button>
            <Button variant="ghost" onClick={cancelarSeleccion}>
              Cancelar
            </Button>
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
            className="bg-surface rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black flex items-center justify-center relative">
              {tomaAbierta.tipo === 'video' ? (
                <video src={tomaAbierta.archivo_url} controls className="max-h-[60vh] w-full" />
              ) : (
                <img src={tomaAbierta.archivo_url} alt="" className="max-h-[60vh] w-full object-contain" />
              )}
              {hayAnterior && (
                <button
                  type="button"
                  onClick={irAAnterior}
                  aria-label="Toma anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
                >
                  <IconoChevronIzq className="w-5 h-5" />
                </button>
              )}
              {haySiguiente && (
                <button
                  type="button"
                  disabled={cargando}
                  onClick={irASiguiente}
                  aria-label="Toma siguiente"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 disabled:opacity-50"
                >
                  <IconoChevronDer className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-4 space-y-2">
              {error && <Alert>{error}</Alert>}
              <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                {tomaAbierta.tipo === 'video' ? (
                  <IconoVideo className="w-4 h-4 text-primary-600" />
                ) : (
                  <IconoFoto className="w-4 h-4 text-primary-600" />
                )}
                {tomaAbierta.tipo === 'video' ? 'Video' : 'Foto'}
              </p>
              <p className="text-sm">
                <span className="text-muted">Cliente:</span> {tomaAbierta.cliente_nombre}
              </p>
              <p className="text-sm">
                <span className="text-muted">Pedidos:</span> {tomaAbierta.pedidos.join(', ')}
              </p>
              <p className="text-sm">
                <span className="text-muted">Fecha:</span>{' '}
                {new Date(tomaAbierta.fecha_hora).toLocaleString('es-AR')}
              </p>
              <p className="text-sm">
                <span className="text-muted">Cargado por:</span> {tomaAbierta.usuario_nombre}
              </p>
              {tomaAbierta.observaciones && (
                <p className="text-sm">
                  <span className="text-muted">Observaciones:</span> {tomaAbierta.observaciones}
                </p>
              )}
              {esAdmin && tomaAbierta.drive_url && (
                <a
                  href={tomaAbierta.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 block"
                >
                  Abrir en Drive
                </a>
              )}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={compartiendo} onClick={() => compartirToma(tomaAbierta)}>
                  {compartiendo ? 'Preparando...' : 'Compartir'}
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(textoToma(tomaAbierta))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium text-center"
                >
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `Toma - ${tomaAbierta.cliente_nombre}`
                  )}&body=${encodeURIComponent(textoToma(tomaAbierta))}`}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium text-center"
                >
                  Email
                </a>
              </div>

              {confirmarEliminar ? (
                <div className="flex gap-2 pt-2">
                  <p className="flex-1 text-sm text-red-700 flex items-center">¿Eliminar esta toma?</p>
                  <Button variant="danger" disabled={eliminando} onClick={() => eliminarToma(tomaAbierta.id)}>
                    {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmarEliminar(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={cerrarModal}>
                    Cerrar
                  </Button>
                  {esAdmin && (
                    <Button variant="danger" className="flex-1" onClick={() => setConfirmarEliminar(true)}>
                      Eliminar
                    </Button>
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
