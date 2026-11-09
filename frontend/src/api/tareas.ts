import type { Agenda, AgendarRequest, OrdenRecomendacion, SentidoOrden, Tarea, TareaRecomendada, TareaRequest } from '@/types/tarea'
import { del, get, patch, post, put } from './client'

/** Agenda de un día (`fecha` = YYYY-MM-DD): tareas con hora y lista del día. */
export function getAgenda(fecha: string): Promise<Agenda> {
  return get<Agenda>('/api/tareas/agenda', { fecha })
}

/** Todas las tareas, sin filtros (el Cofre filtra y ordena en el cliente). */
export function getTareas(): Promise<Tarea[]> {
  return get<Tarea[]>('/api/tareas')
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

/**
 * Siempre con fecha explícita (nunca el "+1" implícito del backend, que suma un día a la fecha de la
 * tarea y no a hoy). Si la tarea tiene fecha, la nueva debe ser posterior (400 si no). Devuelve la tarea con la fecha nueva.
 */
export function posponerTarea(id: number, fecha: string): Promise<Tarea> {
  return patch<Tarea>(`/api/tareas/${id}/posponer`, { fecha })
}

/** 409 si la tarea tiene subtareas. */
export function borrarTarea(id: number): Promise<void> {
  return del(`/api/tareas/${id}`)
}

export interface ParamsRecomendacion {
  /** El "hoy" del cliente (YYYY-MM-DD). */
  fecha: string
  orden?: OrdenRecomendacion
  sentido?: SentidoOrden
  limite?: number
  /** Solo el vínculo directo de la tarea. */
  proyectoId?: number
  objetivoId?: number
}

/** Tareas abiertas sin fecha o atrasadas, con sus subtareas anidadas. Los params sin valor no se envían. */
export function getRecomendacion(params: ParamsRecomendacion): Promise<TareaRecomendada[]> {
  return get<TareaRecomendada[]>('/api/tareas/recomendacion', { ...params })
}

/** Devuelve las tareas modificadas, la madre primero. 409 si la madre está cerrada; 400 si `fecha` < `hoy`. */
export function agendarTarea(id: number, request: AgendarRequest): Promise<Tarea[]> {
  return patch<Tarea[]>(`/api/tareas/${id}/agendar`, request)
}
