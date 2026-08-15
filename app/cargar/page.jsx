import { redirect } from 'next/navigation';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { SinPermiso } from '@/app/components/ui';
import CargaForm from './CargaForm';

export default async function CargarPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin', 'operario'])) {
    return <SinPermiso mensaje="No tenés permiso para cargar tomas." />;
  }

  return <CargaForm />;
}