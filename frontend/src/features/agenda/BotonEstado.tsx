import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { EstadoIcono } from './EstadoIcono'
import type { Acciones } from './useAccionesTarea'

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Botón con el icono de estado de una tarea: marca hecha o reabre. Deshabilitado si está cancelada o hay una acción en curso. */
export function BotonEstado({ tarea, acciones }: { tarea: Tarea; acciones: Acciones }) {
  const cancelada = tarea.estado === 'CANCELADO'
  const hecha = tarea.estado === 'HECHO'
  const etiqueta = cancelada
    ? `«${tarea.titulo}» está cancelada`
    : hecha
      ? `Reabrir «${tarea.titulo}»`
      : `Marcar «${tarea.titulo}» como hecha`

  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={cancelada || acciones.pendiente}
      onClick={() => acciones.ejecutar(hecha ? 'reabrir' : 'hecha', tarea)}
      className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-60', FOCO)}
    >
      <EstadoIcono estado={tarea.estado} />
    </button>
  )
}
