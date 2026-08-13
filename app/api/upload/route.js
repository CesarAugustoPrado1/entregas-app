import { handleUpload } from '@vercel/blob/client';
import { getUsuarioActual, requiereRol } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json();

  const usuario = await getUsuarioActual();
  if (!requiereRol(usuario, ['admin', 'operario'])) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['image/*', 'video/*'],
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}