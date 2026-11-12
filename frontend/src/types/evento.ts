// Lo que se lee de EventoResponse. Las fechas llegan como ISO con desfase (`2026-11-10T15:00:00-03:00`).
import type { Prioridad } from './tarea'

export interface Evento {
  id: number
  titulo: string
  descripcion: string | null
  fechaHoraInicio: string
  fechaHoraFin: string
  prioridad: Prioridad | null
}

/**
 * Cuerpo de POST/PUT /api/eventos (EventoRequest). El PUT reemplaza todo: hay que reenviar los cinco campos (una
 * descripción ausente queda vacía y una prioridad ausente, null). Las fechas van como ISO con desfase y el fin debe
 * ser posterior al inicio (si no, 400). El título es obligatorio, de 200 caracteres como máximo.
 */
export interface EventoRequest {
  titulo: string
  descripcion: string
  fechaHoraInicio: string
  fechaHoraFin: string
  prioridad: Prioridad | null
}
