'use client';
import { useState } from 'react';
import Link from 'next/link';

const ROLES = [
  { valor: 'admin', etiqueta: 'Admin' },
  { valor: 'operario', etiqueta: 'Logística (operario)' },
  { valor: 'auditor', etiqueta: 'Observador (auditor)' },
];

export default function UsuariosAdmin({ usuariosIniciales, usuarioActualId }) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('operario');
  const [creando, setCreando] = useState(false);

  const [resetId, setResetId] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [guardandoId, setGuardandoId] = useState(null);

  const crearUsuario = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');
    setCreando(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password, rol }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo crear el usuario');

      setUsuarios((u) => [data.usuario, ...u]);
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('operario');
      setExito('Usuario creado correctamente.');
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario');
    } finally {
      setCreando(false);
    }
  };

  const actualizarUsuario = async (id, cambios) => {
    setError('');
    setExito('');
    setGuardandoId(id);
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo actualizar');

      setUsuarios((lista) => lista.map((u) => (u.id === id ? data.usuario : u)));
      if (cambios.password !== undefined) {
        setExito('Contraseña actualizada.');
        setResetId(null);
        setNuevaPassword('');
      }
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el usuario');
    } finally {
      setGuardandoId(null);
    }
  };

  const guardarNuevaPassword = (id) => {
    if (nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    actualizarUsuario(id, { password: nuevaPassword });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
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

        {/* Crear usuario */}
        <form onSubmit={crearUsuario} className="bg-white rounded-xl shadow p-4 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Crear usuario</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              required
              className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña (mín. 6 caracteres)"
              required
              className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
            />
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creando}
            className="w-full sm:w-auto mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creando ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow divide-y">
          {usuarios.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.nombre}</p>
                  <p className="text-xs text-gray-600 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={u.rol}
                    disabled={u.id === usuarioActualId || guardandoId === u.id}
                    onChange={(e) => actualizarUsuario(u.id, { rol: e.target.value })}
                    className="border rounded-lg px-2 py-1 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.etiqueta}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={u.id === usuarioActualId || guardandoId === u.id}
                    onClick={() => actualizarUsuario(u.id, { activo: !u.activo })}
                    className={`px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-50 ${
                      u.activo ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {u.activo ? 'Activo' : 'Desactivado'}
                  </button>
                </div>
              </div>

              {resetId === u.id ? (
                <div className="flex gap-2 mt-3">
                  <input
                    type="password"
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    disabled={guardandoId === u.id}
                    onClick={() => guardarNuevaPassword(u.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetId(null);
                      setNuevaPassword('');
                    }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResetId(u.id);
                    setNuevaPassword('');
                  }}
                  className="text-xs text-blue-700 hover:underline mt-2"
                >
                  Resetear contraseña
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
