import { redirect } from 'next/navigation';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { listarTomas } from '@/lib/tomas';
import { SinPermiso } from '@/app/components/ui';
import VisorTomas from './VisorTomas';

export default async function VisorPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin', 'operario', 'auditor'])) {
    return <SinPermiso mensaje="No tenés permiso para ver las tomas." />;
  }

  const tomasIniciales = await listarTomas({ limit: 40, offset: 0 });

  return (
    <VisorTomas
      esAdmin={usuario.rol === 'admin'}
      puedeCargar={requiereRol(usuario, ['admin', 'operario'])}
      tomasIniciales={tomasIniciales}
    />
  );
}
