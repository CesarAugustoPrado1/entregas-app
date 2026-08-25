export function celdaCsv(valor) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

export function descargarCsv(nombreArchivo, encabezado, filas) {
  const csv = [encabezado, ...filas].map((fila) => fila.join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
