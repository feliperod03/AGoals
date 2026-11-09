import type { Tarea } from '@/types/tarea'

export interface NodoCofre {
  tarea: Tarea
  subtareas: NodoCofre[]
  /** Título de la madre si esta tarea es raíz del listado pero tiene madre (que no cumple el filtro). */
  madre: string | null
  /** Hijas directas que existen pero el filtro dejó fuera. */
  ocultas: number
}

/**
 * Arma el árbol a partir de las tareas que pasaron el filtro (`filtradas`, ya ordenadas), conservando su
 * orden. Es raíz toda filtrada cuya madre no está entre las filtradas; una madre que no cumple el filtro
 * no se muestra. Si el conjunto forma un ciclo (A↔B) no hay raíz natural: se promueve a raíz la primera
 * sin visitar y un conjunto de visitadas corta la recursión.
 */
export function armarArbol(todas: Tarea[], filtradas: Tarea[]): NodoCofre[] {
  const porId = new Map(todas.map((t) => [t.id, t]))
  const idsFiltradas = new Set(filtradas.map((t) => t.id))
  const hijasFiltradas = new Map<number, Tarea[]>()
  for (const t of filtradas) {
    if (t.padreId !== null && idsFiltradas.has(t.padreId)) {
      hijasFiltradas.set(t.padreId, [...(hijasFiltradas.get(t.padreId) ?? []), t])
    }
  }
  const visitadas = new Set<number>()

  function nodo(tarea: Tarea, esRaiz: boolean): NodoCofre {
    visitadas.add(tarea.id)
    const subtareas = (hijasFiltradas.get(tarea.id) ?? []).filter((h) => !visitadas.has(h.id)).map((h) => nodo(h, false))
    const ocultas = todas.filter((h) => h.padreId === tarea.id && !idsFiltradas.has(h.id)).length
    const madre = esRaiz && tarea.padreId !== null ? (porId.get(tarea.padreId)?.titulo ?? null) : null
    return { tarea, subtareas, madre, ocultas }
  }

  const raices = filtradas.filter((t) => t.padreId === null || !idsFiltradas.has(t.padreId)).map((t) => nodo(t, true))
  // Ciclos: lo que quedó sin visitar no cuelga de ninguna raíz.
  for (const t of filtradas) {
    if (!visitadas.has(t.id)) raices.push(nodo(t, true))
  }
  return raices
}

const estaAbierta = (t: Tarea) => t.estado !== 'HECHO' && t.estado !== 'CANCELADO'

/**
 * Descendientes de `tarea` que "Agendar para hoy" llevaría con ella. Replica la regla de "Agendar con
 * subtareas" del backend: una descendiente es candidata si está abierta y sin fecha o con fecha anterior
 * a `hoy`, y solo se desciende a través de candidatas (una hija de hoy, futura o cerrada corta la rama).
 * Es una copia de la regla del servidor: si cambia allá, hay que cambiarla aquí.
 */
export function subtareasCandidatas(tarea: Tarea, todas: Tarea[], hoy: string): Tarea[] {
  const visitadas = new Set<number>([tarea.id])
  const candidatas: Tarea[] = []
  const pendientes = [tarea.id]
  while (pendientes.length > 0) {
    const padreId = pendientes.shift()!
    for (const hija of todas) {
      if (hija.padreId !== padreId || visitadas.has(hija.id)) continue
      visitadas.add(hija.id)
      if (estaAbierta(hija) && (hija.fecha === null || hija.fecha < hoy)) {
        candidatas.push(hija)
        pendientes.push(hija.id)
      }
    }
  }
  return candidatas
}
