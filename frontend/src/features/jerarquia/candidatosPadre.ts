import { descendientesDe } from '@/features/agenda/descendientes'
import { normalizarTexto } from '@/lib/texto'
import { esAbierto, type ItemJerarquico } from './tipos'

export interface CandidatoPadre<T extends ItemJerarquico> {
  item: T
  /** Lo que se busca y se muestra. */
  texto: string
  /** Para distinguir nombres repetidos: de quién es sub-elemento. */
  detalle: string
}

export interface RotulosPadre {
  /** «Subproyecto de» / «Subobjetivo de»: va seguido del nombre del padre entre comillas angulares. */
  subDe: string
  /** «Proyecto principal» / «Objetivo principal». */
  principal: string
}

export const porNombre = <T extends ItemJerarquico>(a: T, b: T) =>
  normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre), 'es') || a.id - b.id

/**
 * Ítems que se pueden elegir como padre de `actual` (`null` = se está creando uno nuevo): los abiertos, más el
 * padre actual aunque esté cerrado (para no perderlo de la lista). Nunca el propio ítem ni sus descendientes
 * (el backend igual rechaza los ciclos con 400; esto solo evita ofrecerlos). Orden por nombre.
 */
export function candidatosPadre<T extends ItemJerarquico>(actual: T | null, todos: T[], rotulos: RotulosPadre): CandidatoPadre<T>[] {
  const excluidos = new Set<number>(actual ? [actual.id, ...descendientesDe(actual.id, todos).todos.map((i) => i.id)] : [])
  const porId = new Map(todos.map((i) => [i.id, i]))
  return todos
    .filter((i) => !excluidos.has(i.id))
    .filter((i) => esAbierto(i.estado) || i.id === actual?.padreId)
    .sort(porNombre)
    .map((i) => {
      const padre = i.padreId !== null ? porId.get(i.padreId) : undefined
      return { item: i, texto: i.nombre, detalle: padre ? `${rotulos.subDe} «${padre.nombre}»` : rotulos.principal }
    })
}

export interface OpcionObjetivo {
  id: number
  texto: string
}

/**
 * Opciones del `<select>` de objetivo de un proyecto: los objetivos abiertos más el actual aunque esté cerrado.
 * El actual SIEMPRE está, incluso si la lista no cargó (entonces con su número): si no, el select no podría
 * mostrarlo y guardar borraría el vínculo.
 */
export function opcionesObjetivo(objetivos: ItemJerarquico[] | undefined, actualId: number | null): OpcionObjetivo[] {
  const lista = (objetivos ?? []).filter((o) => esAbierto(o.estado) || o.id === actualId).sort(porNombre)
  const opciones = lista.map((o) => ({ id: o.id, texto: o.nombre }))
  if (actualId !== null && !opciones.some((o) => o.id === actualId)) opciones.unshift({ id: actualId, texto: `Objetivo n.º ${actualId}` })
  return opciones
}
