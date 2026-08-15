import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUsuarioActual, requiereRol } from '@/lib/auth';
import { Card } from '@/app/components/ui';
import CerrarSesionBoton from './CerrarSesionBoton';

const ACCIONES = [
  { href: '/cargar', label: 'Cargar toma', roles: ['admin', 'operario'], variant: 'primary' },
  { href: '/visor', label: 'Ver tomas', roles: ['admin', 'operario', 'auditor'], variant: 'secondary' },
  { href: '/estadisticas', label: 'Datos y estadísticas', roles: ['admin', 'auditor'], variant: 'secondary' },
  { href: '/clientes', label: 'Clientes', roles: ['admin'], variant: 'secondary' },
  { href: '/usuarios', label: 'Usuarios', roles: ['admin'], variant: 'secondary' },
];

const VARIANTES = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
};

export default async function Home() {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold mb-1 text-foreground tracking-tight">¡Hola, {usuario.nombre}!</h1>
        <p className="text-sm text-muted mb-6">Rol: {usuario.rol}</p>

        <div className="flex flex-col gap-2 mb-6">
          {ACCIONES.filter((a) => requiereRol(usuario, a.roles)).map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${VARIANTES[a.variant]}`}
            >
              {a.label}
            </Link>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted mb-2">
            ¿Sos otra persona? Cerrá sesión para entrar con tu propio usuario.
          </p>
          <CerrarSesionBoton />
        </div>
      </Card>
    </main>
  );
}
