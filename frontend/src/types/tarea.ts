// DTOs que devuelve el backend (TareaResponse / AgendaResponse). Los nombres son los de la API.
// Las fechas llegan como texto: `fecha` = YYYY-MM-DD, `horaInicio`/`horaFin` = HH:mm:ss.

export type Estado = 'PENDIENTE' | 'EN_PROGRESO' | 'EN_PAUSA' | 'CANCELADO' | 'HECHO'

export type Prioridad = 'BAJA' | 'MEDIA' | 'ALTA'

export interface Tarea {
  id: number
  titulo: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad | null
  fecha: string | null
  horaInicio: string | null
  horaFin: string | null
  padreId: number | null
  proyectoId: number | null
  objetivoId: number | null
  vecesPospuesta: number
  fechaCreacion: string
}

/** Agenda de un día: `conHora` (planificación por horas) y `sinHora` (lista del día). */
export interface Agenda {
  fecha: string
  conHora: Tarea[]
  sinHora: Tarea[]
}
