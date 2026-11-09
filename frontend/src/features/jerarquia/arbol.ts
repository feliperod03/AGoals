import type { ItemJerarquico } from './tipos'

export interface NodoJerarquia<T extends ItemJerarquico> {
  item: T
  hijos: NodoJerarquia<T>[]
  /** Nombre del padre si este ítem es raíz del listado pero tiene padre (que el filtro dejó fuera). */
  padre: string | null
  /** Hijos directos que existen pero el filtro dejó fuera. */
  ocultos: number
}

/**
 * Arma el árbol a partir de los ítems que pasaron el filtro (`filtrados`, ya ordenados), conservando su
 * orden. Es raíz todo filtrado cuyo padre no está entre los filtrados (padre oculto por el filtro, inexistente
 * o el propio ítem); un padre que no cumple el filtro no se muestra. Si el conjunto forma un ciclo (A↔B) no
 * hay raíz natural: se promueve a raíz el primero sin visitar y un conjunto de visitados corta la recursión.
 * Mismo algoritmo que `cofre/arbol.ts`, que trabaja con tareas.
 */
export function armarArbolJerarquia<T extends ItemJerarquico>(todos: T[], filtrados: T[]): NodoJerarquia<T>[] {
  const porId = new Map(todos.map((i) => [i.id, i]))
  const idsFiltrados = new Set(filtrados.map((i) => i.id))
  const hijosFiltrados = new Map<number, T[]>()
  for (const i of filtrados) {
    if (i.padreId !== null && i.padreId !== i.id && idsFiltrados.has(i.padreId)) {
      hijosFiltrados.set(i.padreId, [...(hijosFiltrados.get(i.padreId) ?? []), i])
    }
  }
  const visitados = new Set<number>()

  function nodo(item: T, esRaiz: boolean): NodoJerarquia<T> {
    visitados.add(item.id)
    const hijos = (hijosFiltrados.get(item.id) ?? []).filter((h) => !visitados.has(h.id)).map((h) => nodo(h, false))
    const ocultos = todos.filter((h) => h.padreId === item.id && h.id !== item.id && !idsFiltrados.has(h.id)).length
    const padre = esRaiz && item.padreId !== null && item.padreId !== item.id ? (porId.get(item.padreId)?.nombre ?? null) : null
    return { item, hijos, padre, ocultos }
  }

  const raices = filtrados.filter((i) => i.padreId === null || i.padreId === i.id || !idsFiltrados.has(i.padreId)).map((i) => nodo(i, true))
  // Ciclos: lo que quedó sin visitar no cuelga de ninguna raíz.
  for (const i of filtrados) {
    if (!visitados.has(i.id)) raices.push(nodo(i, true))
  }
  return raices
}
