import type { Proyecto, ProyectoRequest } from '@/types/proyecto'
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

/** 409 con mensaje legible si tiene subproyectos, tareas o ideas: el backend nunca borra en cascada. */
export function borrarProyecto(id: number): Promise<void> {
  return del(`/api/proyectos/${id}`)
}
