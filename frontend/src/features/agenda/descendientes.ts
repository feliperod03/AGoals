/** Lo mínimo que necesita el recorrido de jerarquías: sirve para tareas, proyectos y objetivos. */
interface ConPadre {
  id: number
  padreId: number | null
}

/**
 * Descendientes de un elemento en todos los niveles (sin incluirlo) y cuántos son directos.
 * Recorre con un conjunto de visitados que incluye a la raíz, así un ciclo en los datos no la cuelga.
 */
export function descendientesDe<T extends ConPadre>(tareaId: number, todas: T[]): { todos: T[]; directos: number } {
  const hijasPorMadre = new Map<number, T[]>()
  for (const t of todas) {
    if (t.padreId === null) continue
    hijasPorMadre.set(t.padreId, [...(hijasPorMadre.get(t.padreId) ?? []), t])
  }

  const directas = (hijasPorMadre.get(tareaId) ?? []).filter((t) => t.id !== tareaId)
  const visitados = new Set<number>([tareaId])
  const todos: T[] = []
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
 * Ancestros de un elemento (madre, abuela, …), sin incluirlo. Sube por `padreId` con un conjunto de
 * visitados que incluye al elemento, así un ciclo en los datos no cuelga; una madre inexistente corta la subida.
 */
export function ancestrosDe<T extends ConPadre>(tareaId: number, todas: T[]): T[] {
  const porId = new Map(todas.map((t) => [t.id, t]))
  const visitados = new Set<number>([tareaId])
  const ancestros: T[] = []
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
