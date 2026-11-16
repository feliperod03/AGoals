// Contrato de las series de eventos (SerieEventoRequest, SerieEventoResponse, SerieEventoCreadaResponse).
import type { Evento } from './evento'
import type { Prioridad } from './tarea'

export type Frecuencia = 'SEMANAL' | 'MENSUAL'
export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO'

/** `{}` = 60 minutos antes. Ausente (no el objeto vacío) = sin recordatorio. `minutosAntes`: 0..10080. */
export interface RecordatorioSerieRequest {
  minutosAntes?: number
}

/**
 * Cuerpo de POST /api/series-eventos. Semanal: `diasSemana` + `intervaloSemanas`, SIN `diaMes`. Mensual: `diaMes`, SIN
 * `diasSemana` ni `intervaloSemanas`. Un solo final: `hasta` o `repeticiones` (1..260). La serie empieza «hoy» según
 * `ahora` en `zonaHoraria`; no hay fecha de inicio.
 */
export interface SerieEventoRequest {
  titulo: string
  descripcion: string
  prioridad: Prioridad | null
  /** `HH:mm`. Si `horaFin` < `horaInicio`, termina al día siguiente; iguales (todo el día) = 400. */
  horaInicio: string
  horaFin: string
  /** Id IANA de región (p. ej. America/Argentina/Buenos_Aires), no un desfase. */
  zonaHoraria: string
  /** ISO con desfase, del reloj del cliente. */
  ahora: string
  frecuencia: Frecuencia
  diasSemana?: DiaSemana[]
  intervaloSemanas?: 1 | 2
  diaMes?: number
  /** `YYYY-MM-DD`. */
  hasta?: string
  repeticiones?: number
  recordatorio?: RecordatorioSerieRequest
}

/**
 * Cuerpo de PUT /api/eventos/{id}/serie (SerieEventoEdicionRequest): edita este evento y los siguientes de su serie.
 * Reemplazo completo: `recordatorio: null` BORRA los recordatorios pendientes de todas esas ocurrencias; `{}` = 60 min.
 * La regla (días, intervalo, final) no se cambia, y cada ocurrencia conserva su día.
 */
export interface SerieEventoEdicionRequest {
  titulo: string
  descripcion: string
  prioridad: Prioridad | null
  /** `HH:mm`. Si `horaFin` < `horaInicio`, termina al día siguiente; iguales (todo el día) = 400. */
  horaInicio: string
  horaFin: string
  /** ISO con desfase, del reloj del cliente. */
  ahora: string
  recordatorio: RecordatorioSerieRequest | null
}

/** Respuesta de PUT /api/eventos/{id}/serie. */
export interface SerieEventoEditada {
  /** Las ocurrencias modificadas (la elegida y las siguientes). */
  eventos: Evento[]
  /** Ocurrencias cuyo nuevo recordatorio ya habría pasado: su recordatorio pendiente quedó como estaba. */
  recordatoriosOmitidos: number
}

export interface SerieEvento {
  id: number
  frecuencia: Frecuencia
  diasSemana: DiaSemana[] | null
  intervaloSemanas: number | null
  diaMes: number | null
  fechaInicio: string
  hasta: string | null
  repeticiones: number | null
  zonaHoraria: string
}

export interface SerieEventoCreada {
  serie: SerieEvento
  eventos: Evento[]
  recordatoriosCreados: number
  /** Ocurrencias cuyo recordatorio ya habría pasado: la ocurrencia sí se creó. */
  recordatoriosOmitidos: number
}
