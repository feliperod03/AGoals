import type { Evento, EventoRequest } from '@/types/evento'
import { del, get, post, put } from './client'

/** Eventos que se solapan con [desde, hasta]. Cualquier extremo puede faltar (ISO con desfase). */
export function getEventos(rango: { desde?: string; hasta?: string } = {}): Promise<Evento[]> {
  return get<Evento[]>('/api/eventos', rango)
}

export function getEvento(id: number): Promise<Evento> {
  return get<Evento>(`/api/eventos/${id}`)
}

/** Crea un evento (201). 400 si falta el título o el fin no es posterior al inicio. */
export function crearEvento(req: EventoRequest): Promise<Evento> {
  return post<Evento>('/api/eventos', req)
}

/** Reemplaza el evento completo (el cuerpo lleva los cinco campos). 404 si ya no existe, antes que cualquier 400. */
export function actualizarEvento(id: number, req: EventoRequest): Promise<Evento> {
  return put<Evento>(`/api/eventos/${id}`, req)
}

/** 204, sin 409: si el evento tiene un recordatorio, la base lo borra en cascada. 404 si ya no existe. */
export function borrarEvento(id: number): Promise<void> {
  return del(`/api/eventos/${id}`)
}
