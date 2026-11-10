import type { CandidataBuscador } from '@/components/BuscadorLista'
import { porNombre } from '@/features/jerarquia/candidatosPadre'
import { ETIQUETA_ESTADO, type ItemJerarquico } from '@/features/jerarquia/tipos'
import { compararFechaHora } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import type { Idea } from '@/types/idea'

// Lógica pura de la página de Ideas (sin React): filtros y orden. Todo en el cliente.

export type FiltroEstadoIdea = 'planteadas' | 'concluidas' | 'todas'
/** Con `id` null, `proyecto`/`objetivo` = «ligada a cualquiera de ese tipo». */
export type FiltroVinculoIdea = { tipo: 'todas' } | { tipo: 'sueltas' } | { tipo: 'proyecto' | 'objetivo'; id: number | null }

export interface FiltrosIdeas {
  estado: FiltroEstadoIdea
  vinculo: FiltroVinculoIdea
  busqueda: string
}

/** Vista por defecto: las ideas planteadas (las que siguen abiertas). */
export const FILTROS_POR_DEFECTO: FiltrosIdeas = { estado: 'planteadas', vinculo: { tipo: 'todas' }, busqueda: '' }

export function hayFiltrosActivos(filtros: FiltrosIdeas): boolean {
  return JSON.stringify(filtros) !== JSON.stringify(FILTROS_POR_DEFECTO)
}

function cumpleVinculo(idea: Idea, v: FiltroVinculoIdea): boolean {
  switch (v.tipo) {
    case 'todas':
      return true
    case 'sueltas':
      return idea.proyectoId === null && idea.objetivoId === null
    case 'proyecto':
      return v.id === null ? idea.proyectoId !== null : idea.proyectoId === v.id
    case 'objetivo':
      return v.id === null ? idea.objetivoId !== null : idea.objetivoId === v.id
  }
}

/** Todos los criterios se combinan con AND. La búsqueda mira título y descripción, sin tildes ni mayúsculas. */
export function filtrarIdeas(ideas: Idea[], f: FiltrosIdeas): Idea[] {
  const texto = normalizarTexto(f.busqueda.trim())
  return ideas.filter((i) => {
    if (f.estado === 'planteadas' && i.estado !== 'PLANTEADA') return false
    if (f.estado === 'concluidas' && i.estado !== 'CONCLUIDA') return false
    if (!cumpleVinculo(i, f.vinculo)) return false
    return texto === '' || normalizarTexto(`${i.titulo} ${i.descripcion ?? ''}`).includes(texto)
  })
}

/**
 * Instante por el que se ordena una idea: una CONCLUIDA, por cuándo se cerró; una PLANTEADA, por cuándo se creó.
 * En «Todas» se mezclan los dos tipos de fecha a propósito: lo más reciente de cada idea (su última novedad) va primero.
 * Una concluida sin `fechaCierre` (no debería pasar) cae a su fecha de creación.
 */
export function fechaDeOrden(idea: Idea): string {
  return idea.estado === 'CONCLUIDA' ? (idea.fechaCierre ?? idea.fechaCreacion) : idea.fechaCreacion
}

/** Más recientes primero (ver `fechaDeOrden`); desempate por id descendente. No modifica el arreglo recibido. */
export function ordenarIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort((a, b) => compararFechaHora(fechaDeOrden(b), fechaDeOrden(a)) || b.id - a.id)
}

export interface NombresVinculoIdea {
  proyectos: readonly { id: number; nombre: string }[] | undefined
  objetivos: readonly { id: number; nombre: string }[] | undefined
}

const nombreODefecto = (lista: NombresVinculoIdea['proyectos'], id: number) => lista?.find((i) => i.id === id)?.nombre ?? `n.º ${id}`

/** Texto del estado vacío: con la vista por defecto, «No hay ideas planteadas.»; si no, nombra todos los filtros activos. */
export function textoVacioIdeas(f: FiltrosIdeas, nombres: NombresVinculoIdea): string {
  if (!hayFiltrosActivos(f)) return 'No hay ideas planteadas.'
  const partes: string[] = []
  if (f.estado === 'planteadas') partes.push('Planteadas')
  if (f.estado === 'concluidas') partes.push('Concluidas')
  const v = f.vinculo
  if (v.tipo === 'sueltas') partes.push('Sueltas')
  if (v.tipo === 'proyecto') partes.push(v.id === null ? 'De algún proyecto' : `Del proyecto «${nombreODefecto(nombres.proyectos, v.id)}»`)
  if (v.tipo === 'objetivo') partes.push(v.id === null ? 'De algún objetivo' : `Del objetivo «${nombreODefecto(nombres.objetivos, v.id)}»`)
  const busqueda = f.busqueda.trim()
  if (busqueda) partes.push(`Título o descripción contiene «${busqueda}»`)
  return partes.length === 0 ? 'No hay ideas.' : `No hay ideas con estos filtros: ${partes.join(', ')}.`
}

/** Candidatas del filtro de vínculo: TODOS los proyectos/objetivos (una idea puede estar ligada a uno cerrado). */
export function todosComoCandidatos<T extends ItemJerarquico>(items: T[]): CandidataBuscador<T>[] {
  return [...items].sort(porNombre).map((i) => ({ item: i, texto: i.nombre, detalle: ETIQUETA_ESTADO[i.estado] }))
}
