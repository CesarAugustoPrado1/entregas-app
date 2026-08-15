'use client';
import { createContext, useContext } from 'react';
import { useColaSubidas } from '@/lib/useColaSubidas';

const ColaContext = createContext(null);

export function useCola() {
  const ctx = useContext(ColaContext);
  if (!ctx) throw new Error('useCola debe usarse dentro de <ColaSubidasProvider>');
  return ctx;
}

export function ColaSubidasProvider({ children }) {
  const cola = useColaSubidas();

  return (
    <ColaContext.Provider value={cola}>
      {children}
      <IndicadorSync cola={cola} />
    </ColaContext.Provider>
  );
}

function IndicadorSync({ cola }) {
  const { pendientes, reintentar } = cola;
  if (pendientes.length === 0) return null;

  const enError = pendientes.filter((p) => p.error).length;

  return (
    <div className="fixed top-3 right-3 z-30 max-w-[calc(100vw-1.5rem)]">
      <div
        className={`flex items-center gap-2 rounded-full shadow-lg px-3 py-1.5 text-xs font-medium ${
          enError > 0 ? 'bg-red-600 text-white' : 'bg-primary-600 text-white'
        }`}
      >
        {enError > 0 ? (
          <>
            <span>
              {enError} toma{enError !== 1 ? 's' : ''} sin subir
            </span>
            <button type="button" onClick={reintentar} className="underline underline-offset-2">
              Reintentar
            </button>
          </>
        ) : (
          <span>
            {pendientes.length} toma{pendientes.length !== 1 ? 's' : ''} sincronizando…
          </span>
        )}
      </div>
    </div>
  );
}
