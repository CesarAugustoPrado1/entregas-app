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
        <h1 className="text-xl font-semibold mb-1">¡Hola, {usuario.nombre}!</h1>
        <p className="text-sm text-gray-500 mb-6">Rol: {usuario.rol}</p>

        <div className="flex flex-col gap-2 mb-6">
          {requiereRol(usuario, ['admin', 'operario']) && (
            <Link href="/cargar" className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Cargar toma
            </Link>
          )}
          <Link href="/visor" className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
            Ver tomas
          </Link>
        </div>

        <CerrarSesionBoton />
      </div>
    </main>
  );
}