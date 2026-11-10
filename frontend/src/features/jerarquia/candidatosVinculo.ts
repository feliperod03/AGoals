import type { CandidataBuscador } from '@/components/BuscadorLista'
import type { CandidataMadre } from '@/features/agenda/candidatasMadre'
import { esAbierta } from '@/features/agenda/candidatasMadre'
import { formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import type { Tarea } from '@/types/tarea'
import { porNombre } from './candidatosPadre'
import { ETIQUETA_ESTADO, esAbierto, type ItemJerarquico } from './tipos'

/** A qué se liga una tarea: el campo de la tarea que guarda el vínculo. */
export type TipoVinculo = 'proyecto' | 'objetivo'

export const CAMPO_DE: Record<TipoVinculo, 'proyectoId' | 'objetivoId'> = {
  proyecto: 'proyectoId',
  objetivo: 'objetivoId',
}

/** Nombre para mostrar de un id; «n.º N» si la lista no lo tiene (misma regla que `ListaCofre`). */
export function nombreDe(items: readonly { id: number; nombre: string }[] | undefined, id: number): string {
  return items?.find((i) => i.id === id)?.nombre ?? `n.º ${id}`
}

/**
 * Proyectos u objetivos que se pueden elegir para una tarea: los abiertos, más el vigente (`idActual`) aunque esté
 * cerrado, para no perderlo de la lista. Orden por nombre.
 */
export function candidatosParaTarea<T extends ItemJerarquico>(items: T[], idActual: number | null): CandidataBuscador<T>[] {
  return items
    .filter((i) => i.id === idActual || esAbierto(i.estado))
    .sort(porNombre)
    .map((i) => ({ item: i, texto: i.nombre, detalle: i.id === idActual ? `Actual · ${ETIQUETA_ESTADO[i.estado]}` : ETIQUETA_ESTADO[i.estado] }))
}

/**
 * Tareas que se pueden ligar al proyecto/objetivo `destinoId`: las abiertas que no son ya suyas. Si la tarea
 * tiene otro, la fila avisa que se moverá. `nombres` = los del mismo tipo (puede faltar si la lista no cargó:
 * entonces sale «n.º N»). Orden por título.
 */
export function candidatasTareaParaDestino(
  tipo: TipoVinculo,
  destinoId: number,
  todas: Tarea[],
  nombres: readonly { id: number; nombre: string }[] | undefined,
): CandidataMadre[] {
  const campo = CAMPO_DE[tipo]
  return todas
    .filter((t) => esAbierta(t) && t[campo] !== destinoId)
    .sort((a, b) => normalizarTexto(a.titulo).localeCompare(normalizarTexto(b.titulo), 'es') || a.id - b.id)
    .map((t) => {
      const otro = t[campo]
      const detalle =
        otro === null ? `Sin ${tipo} · ${t.fecha ? formatearDiaMes(t.fecha) : 'sin fecha'}` : `Ahora es del ${tipo} «${nombreDe(nombres, otro)}»; se moverá`
      return { tarea: t, detalle }
    })
}
