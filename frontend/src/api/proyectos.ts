import type { Elecciones, ImpactoBorradoProyecto } from '@/types/impactoBorrado'
import type { Proyecto, ProyectoRequest } from '@/types/proyecto'
import type { Tarea } from '@/types/tarea'
import { del, get, post, put } from './client'

/** Todos los proyectos, sin filtros (las pantallas filtran y arman el árbol en el cliente). */
export function getProyectos(): Promise<Proyecto[]> {
  return get<Proyecto[]>('/api/proyectos')
}

export function crearProyecto(request: ProyectoRequest): Promise<Proyecto> {
  return post<Proyecto>('/api/proyectos', request)
}

/** El PUT reemplaza todo el proyecto: quien llama debe reenviar todos los campos (ver `ProyectoRequest`). */
export function actualizarProyecto(id: number, request: ProyectoRequest): Promise<Proyecto> {
  return put<Proyecto>(`/api/proyectos/${id}`, request)
}

/** Vista previa del borrado (solo lectura): qué se borraría con estas elecciones. Un parámetro ausente cuenta como conservar. */
export function getImpactoBorradoProyecto(id: number, elecciones: Elecciones = {}): Promise<ImpactoBorradoProyecto> {
  return get<ImpactoBorradoProyecto>(`/api/proyectos/${id}/impacto-borrado`, elecciones)
}

/**
 * `elecciones`: `borrar|conservar` por categoría (`subproyectos`, `tareas`, `ideas`). El backend no decide solo:
 * 409 con mensaje legible si una categoría con elementos no trae su elección.
 */
export function borrarProyecto(id: number, elecciones?: Elecciones): Promise<void> {
  return del(`/api/proyectos/${id}`, elecciones)
}

/**
 * Liga la tarea a este proyecto (PUT sin cuerpo). Si ya era de otro, el backend la REEMPLAZA sin avisar. No toca el
 * vínculo de la tarea con el objetivo. 404 si el proyecto o la tarea no existen.
 */
export function asignarTarea(id: number, tareaId: number): Promise<Tarea> {
  return put<Tarea>(`/api/proyectos/${id}/tareas/${tareaId}`)
}

/** Quita el vínculo (204). 404 si no existe el proyecto o la tarea; 400 si la tarea no pertenece a este proyecto. */
export function quitarTarea(id: number, tareaId: number): Promise<void> {
  return del(`/api/proyectos/${id}/tareas/${tareaId}`)
}
