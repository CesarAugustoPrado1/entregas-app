import { redirect } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import UsuariosAdmin from './UsuariosAdmin';

export default async function UsuariosPage() {
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
  const usuarios = await sql`
    SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY creado_en DESC
  `;

  return <UsuariosAdmin usuariosIniciales={usuarios} usuarioActualId={usuario.id} />;
}
