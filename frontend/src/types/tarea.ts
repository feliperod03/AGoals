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

/**
 * Cuerpo de POST/PUT /api/tareas (TareaRequest). `horaInicio`/`horaFin` van como `HH:mm`.
 * Ojo: el PUT reemplaza todo. `estado` y `padreId` hay que reenviarlos al editar o se pierden
 * (estado vuelve a PENDIENTE y el padre se suelta).
 */
export interface TareaRequest {
  titulo: string
  descripcion: string | null
  estado?: Estado
  prioridad: Prioridad | null
  fecha: string | null
  horaInicio: string | null
  horaFin: string | null
  padreId?: number | null
}

/** Qué hacer con las subtareas al borrar una tarea (`?subtareas=` del DELETE). */
export type ModoSubtareas = 'borrar' | 'conservar'

export type OrdenRecomendacion = 'prioridad' | 'antiguedad'

export type SentidoOrden = 'desc' | 'asc'

/** Tarea sugerida con sus subtareas candidatas (anidadas en todos los niveles; la jerarquía viene armada del backend). */
export interface TareaRecomendada {
  tarea: Tarea
  subtareas: TareaRecomendada[]
}

/** Cuerpo de PATCH /api/tareas/{id}/agendar. `incluirSubtareas` es true por defecto en el backend. */
export interface AgendarRequest {
  fecha: string
  hoy: string
  incluirSubtareas?: boolean
}
