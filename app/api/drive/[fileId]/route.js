import { getAccessToken } from '@/lib/googleDrive';

export async function GET(request, { params }) {
  const { fileId } = await params;
  if (!fileId) {
    return new Response('No encontrado', { status: 404 });
  }

  try {
    const accessToken = await getAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const rango = request.headers.get('range');
    if (rango) headers.Range = rango;

    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers });

    if (!driveRes.ok && driveRes.status !== 206) {
      return new Response('No se pudo obtener el archivo', { status: driveRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', driveRes.headers.get('content-type') || 'application/octet-stream');
    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    responseHeaders.set('Accept-Ranges', 'bytes');
    const contentRange = driveRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);
    const contentLength = driveRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    return new Response(driveRes.body, { status: driveRes.status, headers: responseHeaders });
  } catch (error) {
    console.error(`Error al servir el archivo de Drive ${fileId}:`, error.message);
    return new Response('Error al obtener el archivo', { status: 500 });
  }
}
