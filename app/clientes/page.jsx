import { redirect } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import ClientesAdmin from './ClientesAdmin';

export default async function ClientesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect('/login');

  if (!requiereRol(usuario, ['admin'])) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-700">No tenés permiso para ver esta página.</p>
      </main>
    );
  }

  const sql = neon(process.env.DATABASE_URL);
  const clientes = await sql`SELECT id, nombre, creado_en FROM clientes ORDER BY nombre`;

  return <ClientesAdmin clientesIniciales={clientes} />;
}
