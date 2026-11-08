import type { Agenda, Tarea, TareaRequest } from '@/types/tarea'
import { del, get, patch, post, put } from './client'

/** Agenda de un día (`fecha` = YYYY-MM-DD): tareas con hora y lista del día. */
export function getAgenda(fecha: string): Promise<Agenda> {
  return get<Agenda>('/api/tareas/agenda', { fecha })
}

export function getTarea(id: number): Promise<Tarea> {
  return get<Tarea>(`/api/tareas/${id}`)
}

export function crearTarea(request: TareaRequest): Promise<Tarea> {
  return post<Tarea>('/api/tareas', request)
}

/** El PUT reemplaza toda la tarea: quien llama debe reenviar `estado` y `padreId`. */
export function actualizarTarea(id: number, request: TareaRequest): Promise<Tarea> {
  return put<Tarea>(`/api/tareas/${id}`, request)
}

export function marcarHecha(id: number): Promise<Tarea> {
  return patch<Tarea>(`/api/tareas/${id}/hecha`)
}

export function reabrirTarea(id: number): Promise<Tarea> {
  return patch<Tarea>(`/api/tareas/${id}/reabrir`)
}

/** Sin cuerpo: el backend suma un día a la fecha de la tarea. Devuelve la tarea con la fecha nueva. */
export function posponerTarea(id: number): Promise<Tarea> {
  return patch<Tarea>(`/api/tareas/${id}/posponer`)
}

/** 409 si la tarea tiene subtareas. */
export function borrarTarea(id: number): Promise<void> {
  return del(`/api/tareas/${id}`)
}
