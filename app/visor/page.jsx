import { redirect } from 'next/navigation';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { listarTomas } from '@/lib/tomas';
import VisorTomas from './VisorTomas';

export default async function VisorPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin', 'operario', 'auditor'])) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-700">No tenés permiso para ver las tomas.</p>
      </main>
    );
  }

  const tomasIniciales = await listarTomas({ limit: 40, offset: 0 });

  return <VisorTomas esAdmin={usuario.rol === 'admin'} tomasIniciales={tomasIniciales} />;
}
