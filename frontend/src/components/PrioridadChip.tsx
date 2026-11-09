import { cn } from '@/lib/utils'
import type { Prioridad } from '@/types/tarea'

// Se distinguen por luminosidad y forma (sólido oscuro / beige / solo contorno), no solo por color.
const ESTILOS: Record<Prioridad, { texto: string; clases: string }> = {
  ALTA: { texto: 'Alta', clases: 'bg-alta text-alta-tx' },
  MEDIA: { texto: 'Media', clases: 'bg-media text-media-tx' },
  BAJA: { texto: 'Baja', clases: 'border border-baja text-baja-tx' },
}

export function PrioridadChip({ prioridad }: { prioridad: Prioridad }) {
  const { texto, clases } = ESTILOS[prioridad]
  return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', clases)}>{texto}</span>
}
