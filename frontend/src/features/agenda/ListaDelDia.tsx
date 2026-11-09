import { PrioridadChip } from '@/components/PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { BotonEstado } from './BotonEstado'
import { MenuAcciones } from './MenuAcciones'
import type { Acciones } from './useAccionesTarea'

interface Props {
  tareas: Tarea[] | undefined
  cargando: boolean
  error: Error | null
  alEditar: (tarea: Tarea) => void
  acciones: Acciones
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * Tarjeta "Lista del día": tareas del día sin hora. Cada fila son tres botones hermanos (nunca uno dentro de otro):
 * estado (marcar hecha / reabrir), título (abre la edición) y menú de acciones.
 */
export function ListaDelDia({ tareas, cargando, error, alEditar, acciones }: Props) {
  return (
    <Tarjeta titulo="Lista del día">
      {cargando && <TextoVacio>Cargando tu agenda…</TextoVacio>}
      {error && <ErrorEnLinea mensaje={error.message} />}
      {acciones.error && (
        <div className="mb-3">
          <ErrorEnLinea mensaje={acciones.error} />
        </div>
      )}
      {tareas && tareas.length === 0 && <TextoVacio>No tienes tareas sin hora para hoy.</TextoVacio>}
      {tareas && tareas.length > 0 && (
        <ul className="flex flex-col">
          {tareas.map((tarea) => (
            <Fila key={tarea.id} tarea={tarea} alEditar={alEditar} acciones={acciones} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function Fila({ tarea, alEditar, acciones }: { tarea: Tarea; alEditar: (tarea: Tarea) => void; acciones: Acciones }) {
  const cerrada = tarea.estado === 'HECHO' || tarea.estado === 'CANCELADO'

  return (
    <li className="flex items-center gap-1 border-b border-line last:border-b-0">
      <BotonEstado tarea={tarea} acciones={acciones} />
      <button
        type="button"
        onClick={() => alEditar(tarea)}
        className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 text-left hover:bg-muted', FOCO)}
      >
        <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
        {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
      </button>
      <MenuAcciones tarea={tarea} acciones={acciones} />
    </li>
  )
}
