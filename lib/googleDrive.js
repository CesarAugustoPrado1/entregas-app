async function getAccessToken() {
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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
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

  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return data.webViewLink;
}