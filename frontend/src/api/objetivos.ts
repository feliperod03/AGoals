import type { Elecciones, ImpactoBorradoObjetivo } from '@/types/impactoBorrado'
import type { Objetivo, ObjetivoRequest } from '@/types/objetivo'
import { del, get, post, put } from './client'

/** Todos los objetivos, sin filtros (las pantallas filtran y arman el árbol en el cliente). */
export function getObjetivos(): Promise<Objetivo[]> {
  return get<Objetivo[]>('/api/objetivos')
}

export function crearObjetivo(request: ObjetivoRequest): Promise<Objetivo> {
  return post<Objetivo>('/api/objetivos', request)
}

/** El PUT reemplaza todo el objetivo: quien llama debe reenviar todos los campos (ver `ObjetivoRequest`). */
export function actualizarObjetivo(id: number, request: ObjetivoRequest): Promise<Objetivo> {
  return put<Objetivo>(`/api/objetivos/${id}`, request)
}

/** Vista previa del borrado (solo lectura): qué se borraría con estas elecciones. Un parámetro ausente cuenta como conservar. */
export function getImpactoBorradoObjetivo(id: number, elecciones: Elecciones = {}): Promise<ImpactoBorradoObjetivo> {
  return get<ImpactoBorradoObjetivo>(`/api/objetivos/${id}/impacto-borrado`, elecciones)
}

/**
 * `elecciones`: `borrar|conservar` por categoría (`subobjetivos`, `proyectos`, `tareas`, `ideas`). El backend no
 * decide solo: 409 con mensaje legible si una categoría con elementos no trae su elección.
 */
export function borrarObjetivo(id: number, elecciones?: Elecciones): Promise<void> {
  return del(`/api/objetivos/${id}`, elecciones)
}
