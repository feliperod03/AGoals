import { PrioridadChip } from '@/components/PrioridadChip'
import { BotonEstado } from '@/features/agenda/BotonEstado'
import { MenuAcciones } from '@/features/agenda/MenuAcciones'
import type { Acciones } from '@/features/agenda/useAccionesTarea'
import { esAtrasada, formatearDiaMes } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import type { NodoCofre } from './arbol'
import { FOCO } from './estilos'

interface Props {
  nodos: NodoCofre[]
  hoy: string
  /** Nombres por id para rotular el vínculo de cada tarea; vacíos mientras el listado no cargó. */
  proyectos: ReadonlyMap<number, string>
  objetivos: ReadonlyMap<number, string>
  acciones: Acciones
  alEditar: (tarea: Tarea) => void
  /** Se llama con una tarea a la que se le puede "Agendar para hoy"; solo se ofrece si `puedeAgendar` lo permite. */
  alAgendar: (tarea: Tarea) => void
  puedeAgendar: (tarea: Tarea) => boolean
}

/** Tareas del Cofre con sus subtareas anidadas. Cada fila son botones hermanos: estado, título y menú. */
export function ListaCofre({ nodos, ...resto }: Props) {
  return (
    <ul className="flex flex-col">
      {nodos.map((nodo) => (
        <Fila key={nodo.tarea.id} nodo={nodo} {...resto} />
      ))}
    </ul>
  )
}

function Fila({ nodo, ...resto }: Omit<Props, 'nodos'> & { nodo: NodoCofre }) {
  const { tarea, subtareas, madre, ocultas } = nodo
  const { hoy, proyectos, objetivos, acciones, alEditar, alAgendar, puedeAgendar } = resto
  const cerrada = tarea.estado === 'HECHO' || tarea.estado === 'CANCELADO'
  const atrasada = !cerrada && esAtrasada(tarea.fecha, hoy)
  const vinculos = [
    tarea.proyectoId !== null && `Proyecto: ${proyectos.get(tarea.proyectoId) ?? `n.º ${tarea.proyectoId}`}`,
    tarea.objetivoId !== null && `Objetivo: ${objetivos.get(tarea.objetivoId) ?? `n.º ${tarea.objetivoId}`}`,
  ].filter(Boolean)

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-1">
        <BotonEstado tarea={tarea} acciones={acciones} />
        <button
          type="button"
          onClick={() => alEditar(tarea)}
          className={cn('flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg py-2 text-left hover:bg-muted', FOCO)}
        >
          <span className="flex w-full min-w-0 items-center gap-3">
            <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
            {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs text-mut">
            <span className={atrasada ? 'font-medium text-tx' : undefined}>
              {tarea.fecha ? `${atrasada ? 'Atrasada: ' : ''}${formatearDiaMes(tarea.fecha)}` : 'Sin fecha'}
            </span>
            {vinculos.map((v) => (
              <span key={String(v)}>{v}</span>
            ))}
            {madre && <span>Subtarea de «{madre}»</span>}
          </span>
        </button>
        <MenuAcciones tarea={tarea} acciones={acciones} alAgendar={puedeAgendar(tarea) ? alAgendar : undefined} />
      </div>

      {(subtareas.length > 0 || ocultas > 0) && (
        <div className="ml-6 border-l border-line pl-3">
          {subtareas.length > 0 && (
            <ul className="flex flex-col">
              {subtareas.map((hija) => (
                <Fila key={hija.tarea.id} nodo={hija} {...resto} />
              ))}
            </ul>
          )}
          {ocultas > 0 && (
            <p className="py-1 text-xs text-mut">
              +{ocultas} {ocultas === 1 ? 'subtarea oculta' : 'subtareas ocultas'} por el filtro
            </p>
          )}
        </div>
      )}
    </li>
  )
}
