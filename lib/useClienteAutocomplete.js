import { useState, useRef, useCallback } from 'react';

export function useClienteAutocomplete({ onSeleccionar }) {
  const [query, setQuery] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  const debounceRef = useRef(null);

  const buscar = useCallback((texto) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!texto || texto.trim().length < 2) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(texto)}`);
        const data = await res.json();
        if (!data.ok) {
          setErrorBusqueda(data.error || 'No se pudo buscar clientes');
          setSugerencias([]);
          setMostrarSugerencias(false);
          return;
        }
        setErrorBusqueda('');
        setSugerencias(data.clientes || []);
        setMostrarSugerencias(true);
      } catch {
        setErrorBusqueda('No se pudo conectar para buscar clientes');
        setSugerencias([]);
        setMostrarSugerencias(false);
      }
    }, 300);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onSeleccionar(null);
    buscar(val);
  };

  const elegir = (c) => {
    onSeleccionar(c);
    setQuery(c.nombre);
    setMostrarSugerencias(false);
  };

  const limpiar = () => {
    onSeleccionar(null);
    setQuery('');
  };

  return {
    query,
    sugerencias,
    mostrarSugerencias,
    setMostrarSugerencias,
    errorBusqueda,
    handleChange,
    elegir,
    limpiar,
  };
}
