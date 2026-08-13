import { put } from '@vercel/blob';

export async function GET() {
  try {
    const blob = await put('pruebas/hola.txt', 'Hola desde entregas-app 👋', {
      access: 'public',
      addRandomSuffix: true,
    });
    return Response.json({ ok: true, url: blob.url });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}