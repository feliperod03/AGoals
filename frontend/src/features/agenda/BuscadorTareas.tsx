import type { ReactNode } from 'react'

import { BuscadorLista, FilaBuscador, MAX_FILAS_BUSCADOR } from '@/components/BuscadorLista'
import type { Tarea } from '@/types/tarea'
import type { CandidataMadre } from './candidatasMadre'

/** Filas que se muestran a la vez; el resto se alcanza escribiendo en la búsqueda. */
export const MAX_FILAS = MAX_FILAS_BUSCADOR
export const Fila = FilaBuscador

interface Props {
  idInput: string
  idPanel: string
  etiqueta: string
  candidatas: CandidataMadre[]
  /** Id de la fila vigente (se marca como actual); `null` = ninguna. */
  idActual?: number | null
  /** Fila extra al comienzo de la lista (p. ej. "Sin madre"). */
  filaInicial?: ReactNode
  deshabilitado?: boolean
  alElegir: (tarea: Tarea) => void
}

/**
 * Buscador de tareas por título: adaptador fino de `BuscadorLista` (que pone la búsqueda, el Enter único, el tope
 * de filas y el teclado). Solo traduce `CandidataMadre` a su forma genérica. Lo usan el selector de madre (8.2f),
 * el vínculo de subtareas (8.2g) y las tareas ligadas de proyectos y objetivos.
 */
export function BuscadorTareas({ candidatas, ...resto }: Props) {
  return (
    <BuscadorLista
      {...resto}
      candidatas={candidatas.map((c) => ({ item: c.tarea, texto: c.tarea.titulo, detalle: c.detalle }))}
      textoVacio="Ninguna tarea coincide."
    />
  )
}
