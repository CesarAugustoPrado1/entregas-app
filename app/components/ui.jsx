import Link from 'next/link';

export function PageHeader({ title, subtitle, backHref, children }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0 pt-1">
        {children}
        {backHref && (
          <Link href={backHref} className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Volver
          </Link>
        )}
      </div>
    </div>
  );
}

export function Card({ className = '', padding = 'p-5', children }) {
  return (
    <div className={`bg-surface rounded-2xl shadow-sm ring-1 ring-border ${padding} ${className}`}>{children}</div>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50',
  secondary: 'bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  ghost: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50',
};

export function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Alert({ tipo = 'error', children }) {
  const estilos =
    tipo === 'success'
      ? 'bg-green-50 text-green-700'
      : tipo === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700';
  return <div className={`text-sm rounded-lg px-3 py-2 mb-4 text-center ${estilos}`}>{children}</div>;
}

export function SinPermiso({ mensaje = 'No tenés permiso para ver esta página.' }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <p className="text-muted text-sm">{mensaje}</p>
    </main>
  );
}

export function Badge({ className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1 ${className}`}
    >
      {children}
    </span>
  );
}
