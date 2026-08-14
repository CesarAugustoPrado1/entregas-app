'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ClientesAdmin({ clientesIniciales }) {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

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

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <Link href="/" className="text-sm text-blue-700 hover:underline">
            Volver
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">{error}</div>
        )}
        {exito && (
          <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2 mb-4 text-center">{exito}</div>
        )}

        <form onSubmit={crearCliente} className="bg-white rounded-xl shadow p-4 mb-5 flex gap-2">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
            required
            className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={creando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creando ? 'Creando...' : 'Crear cliente'}
          </button>
        </form>

        <div className="bg-white rounded-xl shadow divide-y">
          {clientes.length === 0 ? (
            <p className="text-sm text-gray-700 p-4 text-center">Todavía no hay clientes cargados.</p>
          ) : (
            clientes.map((c) => (
              <div key={c.id} className="p-3 text-sm font-medium text-gray-900">
                {c.nombre}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
