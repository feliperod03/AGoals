import { useMemo } from 'react'

import { PrioridadChip } from '@/components/PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import { armarArbol, type NodoCofre } from '@/features/cofre/arbol'
import { formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'

interface Props {
  /** Qué vínculo directo de la tarea se mira. */
  campo: 'proyectoId' | 'objetivoId'
  id: number
  titulo: string
  /** Frase bajo el título (p. ej. dónde ver las tareas que no están en esta sección). */
  aclaracion?: string
  textoVacio: string
}

/**
 * Tareas ligadas directamente a un proyecto u objetivo, en SOLO LECTURA (asignarlas o quitarlas es de 8.4b).
 * Sale de `useTodasLasTareas` (`['tareas','todas']`): cada mutación de tarea ya invalida el prefijo `['tareas']`,
 * así que se mantiene fresca sin código extra. Las subtareas ligadas también se anidan bajo su madre.
 */
export function TareasLigadas({ campo, id, titulo, aclaracion, textoVacio }: Props) {
  const tareas = useTodasLasTareas()
  const nodos = useMemo(() => {
    const todas = tareas.data
    if (!todas) return undefined
    const ligadas = todas
      .filter((t) => t[campo] === id)
      .sort((a, b) => Number(esCerrada(a.estado)) - Number(esCerrada(b.estado)) || normalizarTexto(a.titulo).localeCompare(normalizarTexto(b.titulo), 'es') || a.id - b.id)
    return { total: ligadas.length, nodos: armarArbol(todas, ligadas) }
  }, [tareas.data, campo, id])

  return (
    <Tarjeta titulo={titulo}>
      {aclaracion && <p className="mb-3 text-sm text-mut">{aclaracion}</p>}
      {tareas.isPending && <TextoVacio>Cargando tareas…</TextoVacio>}
      {tareas.error && <ErrorEnLinea mensaje={tareas.error.message} />}
      {nodos && nodos.total === 0 && <TextoVacio>{textoVacio}</TextoVacio>}
      {nodos && nodos.total > 0 && (
        <ul className="flex flex-col">
          {nodos.nodos.map((nodo) => (
            <Fila key={nodo.tarea.id} nodo={nodo} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

const esCerrada = (estado: string) => estado === 'HECHO' || estado === 'CANCELADO'

function Fila({ nodo }: { nodo: NodoCofre }) {
  const { tarea, subtareas, madre } = nodo
  const cerrada = esCerrada(tarea.estado)
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 py-2">
        <EstadoIcono estado={tarea.estado} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex w-full min-w-0 items-center gap-3">
            <span className={cn('min-w-0 flex-1 truncate', cerrada && 'text-mut line-through')}>{tarea.titulo}</span>
            {tarea.prioridad && <PrioridadChip prioridad={tarea.prioridad} />}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs text-mut">
            <span>{tarea.fecha ? formatearDiaMes(tarea.fecha) : 'Sin fecha'}</span>
            {madre && <span>Subtarea de «{madre}»</span>}
          </span>
        </div>
      </div>
      {subtareas.length > 0 && (
        <ul className="ml-6 flex flex-col border-l border-line pl-3">
          {subtareas.map((hija) => (
            <Fila key={hija.tarea.id} nodo={hija} />
          ))}
        </ul>
      )}
    </li>
  )
}
