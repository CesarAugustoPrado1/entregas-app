'use client';
import { useState } from 'react';
import { PageHeader, Card, Button, Alert } from '@/app/components/ui';

const ROLES = [
  { valor: 'admin', etiqueta: 'Admin', color: 'bg-purple-500' },
  { valor: 'operario', etiqueta: 'Logística (operario)', color: 'bg-primary-500' },
  { valor: 'auditor', etiqueta: 'Observador (auditor)', color: 'bg-gray-400' },
];

const colorDeRol = (rol) => ROLES.find((r) => r.valor === rol)?.color || 'bg-gray-400';

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
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Usuarios" backHref="/" />

        {error && <Alert>{error}</Alert>}
        {exito && <Alert tipo="success">{exito}</Alert>}

        {/* Crear usuario */}
        <Card className="mb-5">
          <form onSubmit={crearUsuario}>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Crear usuario</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                required
                className="border border-border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="border border-border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña (mín. 6 caracteres)"
                required
                className="border border-border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
              />
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
              >
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={creando} className="w-full sm:w-auto mt-3">
              {creando ? 'Creando...' : 'Crear usuario'}
            </Button>
          </form>
        </Card>

        {/* Lista */}
        <Card padding="" className="divide-y divide-border">
          {usuarios.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.nombre}</p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${colorDeRol(u.rol)}`} title={u.rol} />
                  <select
                    value={u.rol}
                    disabled={u.id === usuarioActualId || guardandoId === u.id}
                    onChange={(e) => actualizarUsuario(u.id, { rol: e.target.value })}
                    className="border border-border rounded-lg px-2 py-1 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
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
                    className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <button
                    type="button"
                    disabled={guardandoId === u.id}
                    onClick={() => guardarNuevaPassword(u.id)}
                    className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
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
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 mt-2"
                >
                  Resetear contraseña
                </button>
              )}
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
