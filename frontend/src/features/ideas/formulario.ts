import type { Idea, IdeaRequest } from '@/types/idea'

export const MAX_TITULO = 200

export type TipoVinculoIdea = 'ninguno' | 'proyecto' | 'objetivo'

/**
 * Valores del formulario. El vínculo es UN solo par `{tipoVinculo, vinculoId}`: así es imposible armar un request
 * con proyecto y objetivo a la vez (el backend responde 400).
 */
export interface ValoresIdea {
  titulo: string
  descripcion: string
  tipoVinculo: TipoVinculoIdea
  vinculoId: number | null
  conclusion: string
}

export function valoresIniciales(idea?: Idea): ValoresIdea {
  if (!idea) return { titulo: '', descripcion: '', tipoVinculo: 'ninguno', vinculoId: null, conclusion: '' }
  const tipoVinculo: TipoVinculoIdea = idea.proyectoId !== null ? 'proyecto' : idea.objetivoId !== null ? 'objetivo' : 'ninguno'
  return {
    titulo: idea.titulo,
    descripcion: idea.descripcion ?? '',
    tipoVinculo,
    vinculoId: idea.proyectoId ?? idea.objetivoId,
    conclusion: idea.conclusion ?? '',
  }
}

/**
 * La conclusión solo se edita cuando la idea ya tiene una o está concluida. Una idea reabierta conserva su
 * conclusión, así que el campo aparece (y viaja en el PUT) aunque esté PLANTEADA.
 */
export function conclusionEditable(idea?: Idea): boolean {
  return idea !== undefined && (idea.conclusion !== null || idea.estado === 'CONCLUIDA')
}

/**
 * Cuerpo del POST/PUT: SIEMPRE los cinco campos (el PUT reemplaza todo). Solo uno de `proyectoId`/`objetivoId` es
 * no nulo. Si el campo de conclusión no se muestra, se reenvía la original (null) y nunca se pierde por omisión.
 */
export function aRequestIdea(valores: ValoresIdea, original?: Idea): IdeaRequest {
  const id = valores.tipoVinculo === 'ninguno' ? null : valores.vinculoId
  const conclusion = conclusionEditable(original) ? valores.conclusion.trim() || null : (original?.conclusion ?? null)
  return {
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim() || null,
    proyectoId: valores.tipoVinculo === 'proyecto' ? id : null,
    objetivoId: valores.tipoVinculo === 'objetivo' ? id : null,
    conclusion,
  }
}
