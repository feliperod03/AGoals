import type { Idea } from '@/types/idea'
import { ordenarIdeas } from './filtros'

// Lógica pura de «Ideas ligadas» (detalle de proyectos y objetivos). Sin React.

/** Cuántas ideas se muestran en el detalle; el resto se resume en «+N más». */
export const LIMITE_IDEAS_LIGADAS = 5

export type CampoVinculoIdea = 'proyectoId' | 'objetivoId'

export interface IdeasLigadas {
  visibles: Idea[]
  /** Las que no caben en el límite. */
  ocultas: number
  total: number
}

/**
 * Las ideas cuyo vínculo DIRECTO es ese proyecto u objetivo (`campo` = `id`), más recientes primero.
 * No incluye las de los hijos ni las de los proyectos de un objetivo. Un `proyectoId` 3 no cuenta para el objetivo 3.
 */
export function ideasLigadas(ideas: Idea[], campo: CampoVinculoIdea, id: number, limite = LIMITE_IDEAS_LIGADAS): IdeasLigadas {
  const propias = ordenarIdeas(ideas.filter((i) => i[campo] === id))
  return { visibles: propias.slice(0, limite), ocultas: Math.max(0, propias.length - limite), total: propias.length }
}

export const textoMasIdeas = (ocultas: number) => `+${ocultas} más`

/** Enlace a la página Ideas con el vínculo preseleccionado (lo lee `filtrosDesdeQuery`). */
export const rutaIdeasDe = (campo: CampoVinculoIdea, id: number) => `/ideas?${campo === 'proyectoId' ? 'proyecto' : 'objetivo'}=${id}`
