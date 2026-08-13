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
    <button onClick={cerrarSesion} className="text-sm text-red-600 hover:underline">
      Cerrar sesión
    </button>
  );
}