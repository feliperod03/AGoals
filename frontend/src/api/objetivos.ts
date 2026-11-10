import type { Elecciones, ImpactoBorradoObjetivo } from '@/types/impactoBorrado'
import type { Objetivo, ObjetivoRequest } from '@/types/objetivo'
import type { Tarea } from '@/types/tarea'
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

/**
 * Liga la tarea a este objetivo (PUT sin cuerpo). Si ya era de otro, el backend la REEMPLAZA sin avisar. No toca el
 * vínculo de la tarea con el proyecto. 404 si el objetivo o la tarea no existen.
 */
export function asignarTarea(id: number, tareaId: number): Promise<Tarea> {
  return put<Tarea>(`/api/objetivos/${id}/tareas/${tareaId}`)
}

/** Quita el vínculo (204). 404 si no existe el objetivo o la tarea; 400 si la tarea no pertenece a este objetivo. */
export function quitarTarea(id: number, tareaId: number): Promise<void> {
  return del(`/api/objetivos/${id}/tareas/${tareaId}`)
}
