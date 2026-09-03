import { unstable_cache } from 'next/cache';

const REINTENTOS_DRIVE = 3;
const ESPERA_REINTENTO_MS = [3000, 9000];

export async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No se pudo obtener el token de Drive: ' + JSON.stringify(data));
  }
  return data.access_token;
}

export async function copiarArchivoADrive(urlArchivo, nombreArchivo, mimeType) {
  const accessToken = await getAccessToken();

  const archivoRes = await fetch(urlArchivo);
  if (!archivoRes.ok) throw new Error('No se pudo descargar el archivo original');
  const arrayBuffer = await archivoRes.arrayBuffer();

  const boundary = 'limite_' + Date.now();
  const metadata = JSON.stringify({ name: nombreArchivo });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.from(arrayBuffer),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await uploadRes.json();
  if (!data.id) {
    throw new Error('No se pudo subir a Drive: ' + JSON.stringify(data));
  }

  // Permiso "cualquiera con el link": el archivo queda accesible sin sesión, tanto por el
  // webViewLink de Drive (botón "Abrir en Drive") como por el proxy /api/drive/[fileId],
  // que tampoco pide sesión. Es intencional: así el cliente puede abrir la toma que se le
  // comparte por WhatsApp o mail sin tener usuario en la app. La contracara es que el link
  // no se puede revocar: sigue funcionando aunque después se borre la toma.
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return { id: data.id, webViewLink: data.webViewLink, tamanoBytes: Number(data.size) || null };
}

// La mayoría de los fallos al copiar a Drive son transitorios (un 5xx de la API, un corte
// al bajar el Blob), así que se reintenta antes de darse por vencido. Si un intento subió
// el archivo pero falló después, el reintento puede dejar un duplicado huérfano en Drive:
// es preferible a perder la migración, que dejaría la toma sin respaldo.
export async function copiarArchivoADriveConReintentos(urlArchivo, nombreArchivo, mimeType) {
  let ultimoError;

  for (let intento = 0; intento < REINTENTOS_DRIVE; intento++) {
    if (intento > 0) {
      await new Promise((resolve) => setTimeout(resolve, ESPERA_REINTENTO_MS[intento - 1]));
    }
    try {
      return await copiarArchivoADrive(urlArchivo, nombreArchivo, mimeType);
    } catch (error) {
      ultimoError = error;
      console.error(`Intento ${intento + 1}/${REINTENTOS_DRIVE} de copiar a Drive falló:`, error.message);
    }
  }

  throw ultimoError;
}

// Sin cache: para decidir si hay que borrar archivos no sirve un dato de hasta
// 5 minutos de antiguedad.
export async function obtenerUsoDriveFresco() {
  const accessToken = await getAccessToken();

  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.storageQuota) {
    throw new Error('No se pudo obtener el uso de Drive: ' + JSON.stringify(data));
  }

  return { usadoBytes: Number(data.storageQuota.usageInDrive || 0) };
}

// El uso de Drive cambia lentamente; se cachea 5 minutos para no golpear la
// API de Drive en cada apertura de la pantalla de estadísticas.
export const obtenerUsoDrive = unstable_cache(obtenerUsoDriveFresco, ['uso-drive'], {
  revalidate: 300,
});

// Borra un archivo de Drive DEFINITIVAMENTE. files.delete de la API v3 no lo manda
// a la papelera, y eso es justamente lo que queremos: lo que está en la papelera
// sigue ocupando cupo, así que mandarlo ahí no liberaría nada.
export async function borrarArchivoDeDrive(fileId, accessToken) {
  const token = accessToken || (await getAccessToken());

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  // 404 = ya no está. Para el que llama es lo mismo que haberlo borrado.
  if (!res.ok && res.status !== 404) {
    throw new Error(`No se pudo borrar el archivo ${fileId} de Drive (HTTP ${res.status})`);
  }
}
