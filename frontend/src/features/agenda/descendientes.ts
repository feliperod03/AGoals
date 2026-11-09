import type { Tarea } from '@/types/tarea'

/**
 * Descendientes de una tarea en todos los niveles (sin incluirla) y cuántos son directos.
 * Recorre con un conjunto de visitados que incluye a la raíz, así un ciclo en los datos no la cuelga.
 */
export function descendientesDe(tareaId: number, todas: Tarea[]): { todos: Tarea[]; directos: number } {
  const hijasPorMadre = new Map<number, Tarea[]>()
  for (const t of todas) {
    if (t.padreId === null) continue
    hijasPorMadre.set(t.padreId, [...(hijasPorMadre.get(t.padreId) ?? []), t])
  }

  const directas = (hijasPorMadre.get(tareaId) ?? []).filter((t) => t.id !== tareaId)
  const visitados = new Set<number>([tareaId])
  const todos: Tarea[] = []
  const pendientes = [...directas]
  while (pendientes.length > 0) {
    const actual = pendientes.shift()!
    if (visitados.has(actual.id)) continue
    visitados.add(actual.id)
    todos.push(actual)
    pendientes.push(...(hijasPorMadre.get(actual.id) ?? []))
  }
  return { todos, directos: directas.filter((t) => visitados.has(t.id)).length }
}
