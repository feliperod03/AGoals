import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { EstadoIcono } from './EstadoIcono'
import { PrioridadChip } from './PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from './Tarjeta'

interface Props {
  tareas: Tarea[] | undefined
  cargando: boolean
  error: Error | null
}

/** Tarjeta "Lista del día": tareas del día sin hora. Solo lectura. */
export function ListaDelDia({ tareas, cargando, error }: Props) {
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
              <li key={tarea.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                <EstadoIcono estado={tarea.estado} />
                <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
                {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
              </li>
            )
          })}
        </ul>
      )}
    </Tarjeta>
  )
}
