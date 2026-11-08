import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Tarjeta de la página Hoy: fondo `card`, radio ~18 px, sombra suave y título en Fraunces. */
export function Tarjeta({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card bg-card p-5 shadow-card', className)}>
      <h2 className="mb-4 font-serif text-[22px] leading-tight">{titulo}</h2>
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
