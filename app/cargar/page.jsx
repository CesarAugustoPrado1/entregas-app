import { redirect } from 'next/navigation';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import CargaForm from './CargaForm';

export default async function CargarPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin', 'operario'])) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-700">No tenés permiso para cargar tomas.</p>
      </main>
    );
  }

  return <CargaForm />;
}