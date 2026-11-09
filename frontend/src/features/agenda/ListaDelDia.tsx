import { Ellipsis } from 'lucide-react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import { EstadoIcono } from './EstadoIcono'
import { puedePosponer } from './formularioTarea'
import { PrioridadChip } from './PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from './Tarjeta'
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
  const cancelada = tarea.estado === 'CANCELADO'
  const hecha = tarea.estado === 'HECHO'
  const etiquetaEstado = cancelada
    ? `«${tarea.titulo}» está cancelada`
    : hecha
      ? `Reabrir «${tarea.titulo}»`
      : `Marcar «${tarea.titulo}» como hecha`

  return (
    <li className="flex items-center gap-1 border-b border-line last:border-b-0">
      <button
        type="button"
        aria-label={etiquetaEstado}
        disabled={cancelada || acciones.pendiente}
        onClick={() => acciones.ejecutar(hecha ? 'reabrir' : 'hecha', tarea)}
        className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:pointer-events-none disabled:opacity-60', FOCO)}
      >
        <EstadoIcono estado={tarea.estado} />
      </button>
      <button
        type="button"
        onClick={() => alEditar(tarea)}
        className={cn('flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 text-left hover:bg-muted', FOCO)}
      >
        <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
        {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Acciones de «${tarea.titulo}»`}
          disabled={acciones.pendiente}
          className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted disabled:opacity-60', FOCO)}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {puedePosponer(tarea) && <DropdownMenuItem onSelect={() => acciones.pedirPosponer(tarea)}>Posponer</DropdownMenuItem>}
          {cancelada ? (
            <DropdownMenuItem onSelect={() => acciones.ejecutar('reactivar', tarea)}>Reactivar</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => acciones.ejecutar('cancelar', tarea)}>Cancelar</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => acciones.pedirBorrado(tarea)}>Borrar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
