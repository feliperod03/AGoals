import { formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import type { Tarea } from '@/types/tarea'
import { esAbierta, type CandidataMadre } from './candidatasMadre'
import { ancestrosDe } from './descendientes'

/**
 * Tareas que se pueden vincular como subtarea de `madre`: las abiertas, salvo la propia madre, sus
 * ancestros (colgarlos de ella crearía un ciclo; el backend igual lo rechaza con 400) y sus subtareas
 * directas (ya lo son). Si la candidata ya tiene otra madre, el detalle avisa que se va a mover.
 * Orden por título sin tildes ni mayúsculas.
 */
export function candidatasSubtarea(madre: Tarea, todas: Tarea[]): CandidataMadre[] {
  const excluidas = new Set<number>([madre.id, ...ancestrosDe(madre.id, todas).map((t) => t.id)])
  const porId = new Map(todas.map((t) => [t.id, t]))
  return todas
    .filter((t) => !excluidas.has(t.id) && t.padreId !== madre.id && esAbierta(t))
    .sort((a, b) => normalizarTexto(a.titulo).localeCompare(normalizarTexto(b.titulo), 'es') || a.id - b.id)
    .map((t) => {
      const actual = t.padreId !== null ? porId.get(t.padreId) : undefined
      const origen = actual ? `Ahora es subtarea de «${actual.titulo}»; se moverá` : 'Tarea principal'
      return { tarea: t, detalle: `${origen} · ${t.fecha ? formatearDiaMes(t.fecha) : 'sin fecha'}` }
    })
}
