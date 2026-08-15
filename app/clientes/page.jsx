import { redirect } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { SinPermiso } from '@/app/components/ui';
import ClientesAdmin from './ClientesAdmin';

export default async function ClientesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin'])) {
    return <SinPermiso />;
  }

  const sql = neon(process.env.DATABASE_URL);
  const clientes = await sql`SELECT id, nombre, creado_en FROM clientes ORDER BY nombre`;

  return <ClientesAdmin clientesIniciales={clientes} />;
}
