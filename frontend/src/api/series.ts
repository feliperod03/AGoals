import type { SerieEventoCreada, SerieEventoEdicionRequest, SerieEventoEditada, SerieEventoRequest } from '@/types/serie'
import { del, post, put } from './client'

/**
 * Edita el evento y los siguientes de su serie (200). 400 con el motivo del servidor (horas iguales, minutos fuera de
 * 0..10080…); 404 si el evento no existe; 409 si no pertenece a una serie.
 */
export function editarSerieDesde(eventoId: number, req: SerieEventoEdicionRequest): Promise<SerieEventoEditada> {
  return put<SerieEventoEditada>(`/api/eventos/${eventoId}/serie`, req)
}

/** Crea una serie y todas sus ocurrencias (201). 400 con el motivo del servidor (tope de 260, «todo el día», final faltante…). */
export function crearSerie(req: SerieEventoRequest): Promise<SerieEventoCreada> {
  return post<SerieEventoCreada>('/api/series-eventos', req)
}

/**
 * Borra el evento y los siguientes de su serie (204). Si no queda ninguno anterior, borra la serie; si no, recorta su
 * final. 404 si el evento no existe; 409 si no pertenece a una serie.
 */
export function borrarSerieDesde(eventoId: number): Promise<void> {
  return del(`/api/eventos/${eventoId}/serie`)
}
