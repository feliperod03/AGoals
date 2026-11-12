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

export function ErrorEnLinea({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
      {mensaje}
    </p>
  )
}

export function TextoVacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-mut">{children}</p>
}
