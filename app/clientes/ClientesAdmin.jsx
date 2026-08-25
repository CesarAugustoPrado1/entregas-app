'use client';
import { useState } from 'react';
import { PageHeader, Card, Button, Alert } from '@/app/components/ui';
import { patchJSON } from '@/lib/api';
import { descargarCsv, celdaCsv } from '@/lib/exportarCsv';

export default function ClientesAdmin({ clientesIniciales }) {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const crearCliente = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');
    setCreando(true);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo crear el cliente');

      setClientes((prev) => [...prev, data.cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNombre('');
      setExito('Cliente creado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente');
    } finally {
      setCreando(false);
    }
  };

  const actualizarCliente = async (id, cambios) => {
    setError('');
    setExito('');
    setGuardandoId(id);
    try {
      const data = await patchJSON(`/api/clientes/${id}`, cambios);
      setClientes((lista) => lista.map((c) => (c.id === id ? data.cliente : c)));
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el cliente');
    } finally {
      setGuardandoId(null);
    }
  };

  const exportarClientes = () => {
    const encabezado = ['id', 'nombre', 'estado', 'creado_en'];
    const filas = clientes.map((c) => [
      c.id,
      celdaCsv(c.nombre),
      c.activo ? 'activo' : 'inactivo',
      new Date(c.creado_en).toISOString(),
    ]);
    descargarCsv(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, encabezado, filas);
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Clientes" backHref="/">
          <Button type="button" variant="ghost" onClick={exportarClientes} className="shrink-0">
            Exportar
          </Button>
        </PageHeader>

        {error && <Alert>{error}</Alert>}
        {exito && <Alert tipo="success">{exito}</Alert>}

        <Card className="mb-5">
          <form onSubmit={crearCliente} className="flex gap-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente"
              required
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
            />
            <Button type="submit" disabled={creando}>
              {creando ? 'Creando...' : 'Crear cliente'}
            </Button>
          </form>
        </Card>

        <Card padding="" className="divide-y divide-border">
          {clientes.length === 0 ? (
            <p className="text-sm text-muted p-4 text-center">Todavía no hay clientes cargados.</p>
          ) : (
            clientes.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${c.activo ? 'text-gray-900' : 'text-gray-400'}`}>
                  {c.nombre}
                </span>
                <button
                  type="button"
                  disabled={guardandoId === c.id}
                  onClick={() => actualizarCliente(c.id, { activo: !c.activo })}
                  className={`px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-50 shrink-0 ${
                    c.activo ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {c.activo ? 'Activo' : 'Desactivado'}
                </button>
              </div>
            ))
          )}
        </Card>
      </div>
    </main>
  );
}
