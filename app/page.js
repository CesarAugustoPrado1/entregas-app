import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import CerrarSesionBoton from './CerrarSesionBoton';

export default async function Home() {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold mb-1 text-gray-900">¡Hola, {usuario.nombre}!</h1>
        <p className="text-sm text-gray-700 mb-6">Rol: {usuario.rol}</p>

        <div className="flex flex-col gap-2 mb-6">
          {requiereRol(usuario, ['admin', 'operario']) && (
            <Link href="/cargar" className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Cargar toma
            </Link>
          )}
          <Link href="/visor" className="w-full py-2.5 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium">
            Ver tomas
          </Link>
          {requiereRol(usuario, ['admin']) && (
            <Link href="/usuarios" className="w-full py-2.5 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium">
              Usuarios
            </Link>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-gray-600 mb-2">
            ¿Sos otra persona? Cerrá sesión para entrar con tu propio usuario.
          </p>
          <CerrarSesionBoton />
        </div>
      </div>
    </main>
  );
}