import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { EstadoIcono } from './EstadoIcono'
import { PrioridadChip } from './PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from './Tarjeta'

interface Props {
  tareas: Tarea[] | undefined
  cargando: boolean
  error: Error | null
  alEditar: (tarea: Tarea) => void
}

/** Tarjeta "Lista del día": tareas del día sin hora. Cada fila es un botón que abre la edición. */
export function ListaDelDia({ tareas, cargando, error, alEditar }: Props) {
  return (
    <Tarjeta titulo="Lista del día">
      {cargando && <TextoVacio>Cargando tu agenda…</TextoVacio>}
      {error && <ErrorEnLinea mensaje={error.message} />}
      {tareas && tareas.length === 0 && <TextoVacio>No tienes tareas sin hora para hoy.</TextoVacio>}
      {tareas && tareas.length > 0 && (
        <ul className="flex flex-col">
          {tareas.map((tarea) => {
            const cerrada = tarea.estado === 'HECHO' || tarea.estado === 'CANCELADO'
            return (
              <li key={tarea.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => alEditar(tarea)}
                  className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <EstadoIcono estado={tarea.estado} />
                  <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
                  {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}
