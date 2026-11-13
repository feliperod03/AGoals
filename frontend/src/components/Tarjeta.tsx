import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PropsTarjeta {
  /** Sin título (la página ya lo muestra en su h1) no se dibuja el h2; entonces conviene dar `ariaLabel`. */
  titulo?: string
  ariaLabel?: string
  children: ReactNode
  className?: string
}

/** Tarjeta de la página Hoy: fondo `card`, radio ~18 px, sombra suave y título en Fraunces. */
export function Tarjeta({ titulo, ariaLabel, children, className }: PropsTarjeta) {
  return (
    <section aria-label={titulo === undefined ? ariaLabel : undefined} className={cn('rounded-card bg-card p-5 shadow-card', className)}>
      {titulo !== undefined && <h2 className="mb-4 font-serif text-[22px] leading-tight">{titulo}</h2>}
      {children}
    </section>
  )
}

/**
 * Error de una acción lanzada desde la página. Con `alDescartar` se puede quitar con «×» (el botón queda fuera del
 * `role="alert"` para que no se lea como parte del mensaje); sin ella se ve igual que siempre.
 */
export function ErrorEnLinea({ mensaje, alDescartar }: { mensaje: string; alDescartar?: () => void }) {
  if (!alDescartar) {
    return (
      <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
        {mensaje}
      </p>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-alta py-1 pr-1 pl-3 text-sm text-tx">
      <p role="alert" className="min-w-0 flex-1 py-1">
        {mensaje}
      </p>
      <button
        type="button"
        aria-label="Descartar error"
        onClick={alDescartar}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted hover:text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-sm:size-11"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export function TextoVacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-mut">{children}</p>
}
