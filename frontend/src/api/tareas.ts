import type { Agenda, Tarea, TareaRequest } from '@/types/tarea'
import { get, post, put } from './client'

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
