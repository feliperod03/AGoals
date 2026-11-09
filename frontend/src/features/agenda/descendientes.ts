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

/**
 * Ancestros de una tarea (madre, abuela, …), sin incluirla. Sube por `padreId` con un conjunto de
 * visitados que incluye a la tarea, así un ciclo en los datos no cuelga; una madre inexistente corta la subida.
 */
export function ancestrosDe(tareaId: number, todas: Tarea[]): Tarea[] {
  const porId = new Map(todas.map((t) => [t.id, t]))
  const visitados = new Set<number>([tareaId])
  const ancestros: Tarea[] = []
  let actual = porId.get(tareaId)
  while (actual && actual.padreId !== null) {
    const madre = porId.get(actual.padreId)
    if (!madre || visitados.has(madre.id)) break
    visitados.add(madre.id)
    ancestros.push(madre)
    actual = madre
  }
  return ancestros
}
