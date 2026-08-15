'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Alert } from '@/app/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError('No se pudo conectar. Probá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-sm w-full">
        <form onSubmit={handleSubmit}>
          <h1 className="text-2xl font-semibold mb-1 text-center text-foreground tracking-tight">Entregas</h1>
          <p className="text-sm text-muted text-center mb-6">Iniciá sesión para continuar</p>
          {error && <Alert>{error}</Alert>}
          <label className="block text-sm font-medium mb-1 text-gray-800">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-border rounded-lg px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-primary-400"
          />
          <label className="block text-sm font-medium mb-1 text-gray-800">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-border rounded-lg px-3 py-2 mb-6 outline-none focus:ring-2 focus:ring-primary-400"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>

          <p className="text-xs text-muted text-center mt-4">
            ¿Olvidaste tu contraseña? Pedile a un administrador que te la resetee desde Usuarios.
          </p>
        </form>
      </Card>
    </main>
  );
}
