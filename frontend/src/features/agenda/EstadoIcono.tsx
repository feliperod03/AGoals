import { Circle, CircleCheck, CircleDot, CirclePause, CircleX, type LucideIcon } from 'lucide-react'

import type { Estado } from '@/types/tarea'

const ESTADOS: Record<Estado, { icono: LucideIcon; texto: string }> = {
  PENDIENTE: { icono: Circle, texto: 'Pendiente' },
  EN_PROGRESO: { icono: CircleDot, texto: 'En progreso' },
  EN_PAUSA: { icono: CirclePause, texto: 'En pausa' },
  HECHO: { icono: CircleCheck, texto: 'Hecha' },
  CANCELADO: { icono: CircleX, texto: 'Cancelada' },
}

/**
 * Indicador de estado, solo informativo (no es un control): icono más el estado para lectores de pantalla.
 * `decorativo` omite ese texto oculto cuando el estado ya se escribe al lado (p. ej. proyectos y objetivos,
 * donde se dice «Hecho» y no «Hecha»).
 */
export function EstadoIcono({ estado, decorativo = false }: { estado: Estado; decorativo?: boolean }) {
  const { icono: Icono, texto } = ESTADOS[estado]
  const cerrada = estado === 'HECHO' || estado === 'CANCELADO'
  return (
    <span className="inline-flex shrink-0">
      <Icono className={cerrada ? 'size-5 text-mut' : 'size-5 text-gold'} aria-hidden="true" />
      {!decorativo && <span className="sr-only">{texto}</span>}
    </span>
  )
}
