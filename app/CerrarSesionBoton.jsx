'use client';
import { useRouter } from 'next/navigation';

export default function CerrarSesionBoton() {
  const router = useRouter();

  const cerrarSesion = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <button onClick={cerrarSesion} className="text-sm font-medium text-red-600 hover:text-red-700">
      Cerrar sesión
    </button>
  );
}