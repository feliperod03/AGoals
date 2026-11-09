import { formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import type { Tarea } from '@/types/tarea'
import { descendientesDe } from './descendientes'

export interface CandidataMadre {
  tarea: Tarea
  /** Para distinguir títulos repetidos: de quién es subtarea y su fecha. */
  detalle: string
}

/**
 * Tareas que se pueden elegir como madre de `tarea`: las abiertas, más la madre actual aunque esté
 * cerrada (para no perderla de la lista). Nunca la propia tarea ni sus descendientes (el backend
 * igual rechaza los ciclos con 400; esto solo evita ofrecerlos). Orden por título sin tildes ni mayúsculas.
 */
export function candidatasMadre(tarea: Tarea, todas: Tarea[]): CandidataMadre[] {
  const excluidas = new Set<number>([tarea.id, ...descendientesDe(tarea.id, todas).todos.map((t) => t.id)])
  const porId = new Map(todas.map((t) => [t.id, t]))
  return todas
    .filter((t) => !excluidas.has(t.id))
    .filter((t) => t.id === tarea.padreId || esAbierta(t))
    .sort((a, b) => normalizarTexto(a.titulo).localeCompare(normalizarTexto(b.titulo), 'es') || a.id - b.id)
    .map((t) => {
      const madre = t.padreId !== null ? porId.get(t.padreId) : undefined
      const origen = madre ? `Subtarea de «${madre.titulo}»` : 'Tarea principal'
      return { tarea: t, detalle: `${origen} · ${t.fecha ? formatearDiaMes(t.fecha) : 'sin fecha'}` }
    })
}

export function esAbierta(t: Tarea): boolean {
  return t.estado === 'PENDIENTE' || t.estado === 'EN_PROGRESO' || t.estado === 'EN_PAUSA'
}
