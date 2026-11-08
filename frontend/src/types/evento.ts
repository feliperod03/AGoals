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
