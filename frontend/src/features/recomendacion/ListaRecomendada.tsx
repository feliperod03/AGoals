import { CalendarOff, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { esAtrasada, formatearDiaMes } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Tarea, TareaRecomendada } from '@/types/tarea'
import { PrioridadChip } from '@/components/PrioridadChip'
import { contarSubtareas } from './contarSubtareas'

interface Props {
  tareas: TareaRecomendada[]
  hoy: string
  /** Nombres por id para rotular el vínculo de cada tarea; vacíos mientras el listado no cargó. */
  proyectos: ReadonlyMap<number, string>
  objetivos: ReadonlyMap<number, string>
  /** Hay una mutación en curso: los botones se deshabilitan. */
  pendiente: boolean
  alAgendar: (raiz: TareaRecomendada, incluirSubtareas: boolean) => void
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Raíces recomendadas con sus subtareas anidadas (vista previa: la jerarquía viene armada del backend). */
export function ListaRecomendada({ tareas, hoy, proyectos, objetivos, pendiente, alAgendar }: Props) {
  return (
    <ul className="flex flex-col">
      {tareas.map((raiz) => (
        <Raiz key={raiz.tarea.id} raiz={raiz} hoy={hoy} proyectos={proyectos} objetivos={objetivos} pendiente={pendiente} alAgendar={alAgendar} />
      ))}
    </ul>
  )
}

function Raiz({ raiz, hoy, proyectos, objetivos, pendiente, alAgendar }: Omit<Props, 'tareas'> & { raiz: TareaRecomendada }) {
  const { tarea } = raiz
  const cantidad = contarSubtareas(raiz)
  // Por defecto con subtareas, igual que el backend.
  const [incluir, setIncluir] = useState(true)
  const idCheck = `incluir-subtareas-${tarea.id}`

  return (
    <li className="border-b border-line py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <Datos tarea={tarea} hoy={hoy} proyectos={proyectos} objetivos={objetivos} />
        <Button type="button" size="sm" variant="secondary" disabled={pendiente} onClick={() => alAgendar(raiz, cantidad > 0 && incluir)}>
          Agendar <span className="sr-only">«{tarea.titulo}»</span> para hoy
        </Button>
      </div>
      {cantidad > 0 && (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <input
              id={idCheck}
              type="checkbox"
              checked={incluir}
              disabled={pendiente}
              onChange={(e) => setIncluir(e.target.checked)}
              className={cn('size-4 accent-acc', FOCO)}
            />
            <label htmlFor={idCheck}>
              Incluir {cantidad} {cantidad === 1 ? 'subtarea' : 'subtareas'}
              {' '}
              <span className="sr-only">de «{tarea.titulo}»</span>
            </label>
          </div>
          <Subtareas items={raiz.subtareas} hoy={hoy} proyectos={proyectos} objetivos={objetivos} apagadas={!incluir} />
        </>
      )}
    </li>
  )
}

function Subtareas({
  items,
  hoy,
  proyectos,
  objetivos,
  apagadas,
}: {
  items: TareaRecomendada[]
  hoy: string
  proyectos: ReadonlyMap<number, string>
  objetivos: ReadonlyMap<number, string>
  apagadas: boolean
}) {
  return (
    <ul className="mt-2 ml-4 flex flex-col gap-2 border-l border-line pl-4">
      {items.map((hija) => (
        <li key={hija.tarea.id} className={cn(apagadas && 'opacity-60')}>
          <Datos tarea={hija.tarea} hoy={hoy} proyectos={proyectos} objetivos={objetivos} />
          {hija.subtareas.length > 0 && <Subtareas items={hija.subtareas} hoy={hoy} proyectos={proyectos} objetivos={objetivos} apagadas={apagadas} />}
        </li>
      ))}
    </ul>
  )
}

/** Título, marca de fecha, prioridad y vínculo de una tarea. */
function Datos({ tarea, hoy, proyectos, objetivos }: { tarea: Tarea; hoy: string; proyectos: ReadonlyMap<number, string>; objetivos: ReadonlyMap<number, string> }) {
  const proyecto = tarea.proyectoId !== null ? proyectos.get(tarea.proyectoId) : undefined
  const objetivo = tarea.objetivoId !== null ? objetivos.get(tarea.objetivoId) : undefined
  return (
    <div className="min-w-0 flex-1">
      <p className="break-words">{tarea.titulo}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mut">
        <MarcaFecha fecha={tarea.fecha} hoy={hoy} />
        {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
        {proyecto && <span>Proyecto: {proyecto}</span>}
        {objetivo && <span>Objetivo: {objetivo}</span>}
      </div>
    </div>
  )
}

/** "Sin fecha" o "Atrasada desde …": texto más ícono, nunca solo color. */
function MarcaFecha({ fecha, hoy }: { fecha: string | null; hoy: string }) {
  if (fecha === null) {
    return (
      <span className="inline-flex items-center gap-1 font-medium">
        <CalendarOff className="size-3.5" aria-hidden="true" />
        Sin fecha
      </span>
    )
  }
  if (esAtrasada(fecha, hoy)) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-tx">
        <TriangleAlert className="size-3.5" aria-hidden="true" />
        Atrasada desde {formatearDiaMes(fecha)}
      </span>
    )
  }
  return null
}
