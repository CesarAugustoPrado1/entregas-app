'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { agregarPendiente, listarPendientes, actualizarPendiente, eliminarPendiente } from './colaSubidas';

const REINTENTO_MS = 15000;

export function useColaSubidas() {
  const [pendientes, setPendientes] = useState([]);
  const enProceso = useRef(false);
  const procesarRef = useRef(() => {});

  const refrescar = useCallback(async () => {
    const items = await listarPendientes();
    items.sort((a, b) => a.creadoEn - b.creadoEn);
    setPendientes(items);
    return items;
  }, []);

  const procesar = useCallback(async () => {
    if (enProceso.current || !navigator.onLine) return;
    const items = await refrescar();
    const siguiente = items[0];
    if (!siguiente) return;

    enProceso.current = true;
    setPendientes((prev) =>
      prev.map((p) => (p.id === siguiente.id ? { ...p, subiendoAhora: true, progreso: 0, error: null } : p))
    );

    try {
      const nombrePath = siguiente.nombreOriginal || siguiente.nombreArchivo;
      const blob = await upload(`tomas/${siguiente.id}-${nombrePath}`, siguiente.archivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: (evento) => {
          const pct = Math.round(evento.percentage);
          setPendientes((prev) => prev.map((p) => (p.id === siguiente.id ? { ...p, progreso: pct } : p)));
        },
      });

      const res = await fetch('/api/tomas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: siguiente.clienteId,
          pedidos: siguiente.pedidos,
          archivo_url: blob.url,
          tipo: siguiente.tipo,
          observaciones: siguiente.observaciones,
          fecha_hora: siguiente.fechaHora,
          nombre_archivo: siguiente.nombreArchivo,
          mime_type: siguiente.mimeType,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo guardar la toma');

      await eliminarPendiente(siguiente.id);
      enProceso.current = false;
      await refrescar();
      procesarRef.current();
    } catch (err) {
      await actualizarPendiente(siguiente.id, {
        error: err.message || 'No se pudo subir',
        intentos: (siguiente.intentos || 0) + 1,
      });
      enProceso.current = false;
      await refrescar();
    }
  }, [refrescar]);

  useEffect(() => {
    procesarRef.current = procesar;
  }, [procesar]);

  useEffect(() => {
    procesarRef.current();
    const intervalo = setInterval(() => procesarRef.current(), REINTENTO_MS);
    const onOnline = () => procesarRef.current();
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const encolar = useCallback(async (item) => {
    const id = crypto.randomUUID();
    await agregarPendiente({ ...item, id, creadoEn: Date.now(), intentos: 0, error: null });
    await refrescar();
    procesarRef.current();
    return id;
  }, [refrescar]);

  return {
    pendientes,
    sincronizando: pendientes.some((p) => p.subiendoAhora),
    hayErrores: pendientes.some((p) => p.error),
    encolar,
    reintentar: () => procesarRef.current(),
  };
}
