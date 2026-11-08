import type { Evento } from '@/types/evento'
import { get } from './client'

/** Eventos que se solapan con [desde, hasta]. Cualquier extremo puede faltar (ISO con desfase). */
export function getEventos(rango: { desde?: string; hasta?: string } = {}): Promise<Evento[]> {
  return get<Evento[]>('/api/eventos', rango)
}

export function getEvento(id: number): Promise<Evento> {
  return get<Evento>(`/api/eventos/${id}`)
}
