import { parseISO } from 'date-fns'

import { aFechaLocal, deValorDatetimeLocal, esDeDiasCompletos, partesLocales, sumarDias, sumarMinutos } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Canal, Recordatorio, RecordatorioRequest } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'

/** Hora del aviso cuando la tarea no trae una (o no tiene fecha). */
export const HORA_POR_DEFECTO = '09:00'

/**
 * Minutos de anticipación del aviso de un evento que tiene hora. Hoy es fijo y vive solo aquí. A futuro podría
 * parametrizarlo el usuario, cada evento o cada recordatorio; no se diseña todavía.
 */
export const MINUTOS_AVISO_EVENTO = 60

/** Lo que devuelven `useRecordatorioDeTarea` y `useRecordatorioDeEvento`. */
export interface ConsultaRecordatorio {
  recordatorio: Recordatorio | null
  /** Incluye los refrescos: mientras se refresca no se sabe si el recordatorio sigue existiendo. */
  cargando: boolean
  fallo: boolean
  reintentar: () => void
}

/** A quién pertenece el recordatorio que se abre en `RecordatorioDialog`. */
export type DestinoRecordatorio =
  | { tipo: 'tarea'; tarea: Tarea }
  | { tipo: 'evento'; evento: Evento }
  | { tipo: 'suelto' }
  | { tipo: 'existente'; recordatorio: Recordatorio }

/**
 * Valor de `datetime-local` con el que arranca el recordatorio de una tarea nueva: la hora de inicio de la tarea
 * si la tiene; si solo tiene fecha, ese día a las 09:00; si no tiene fecha, mañana a las 09:00.
 */
export function valorInicialTarea(tarea: Tarea, ahora: Date): string {
  if (tarea.fecha === null) return valorInicialSuelto(ahora)
  const hora = tarea.horaInicio ? tarea.horaInicio.slice(0, 5) : HORA_POR_DEFECTO
  return `${tarea.fecha}T${hora}`
}

/**
 * Valor inicial del recordatorio de un evento: de días completos, su primer día a las 09:00; con hora, `MINUTOS_AVISO_EVENTO`
 * minutos antes del inicio (puede caer el día anterior).
 */
export function valorInicialEvento(evento: Evento): string {
  const inicio = partesLocales(evento.fechaHoraInicio)
  if (esDeDiasCompletos(evento.fechaHoraInicio, evento.fechaHoraFin)) return `${inicio.fecha}T${HORA_POR_DEFECTO}`
  const aviso = sumarMinutos(inicio, -MINUTOS_AVISO_EVENTO)
  return aviso ? `${aviso.fecha}T${aviso.hora}` : `${inicio.fecha}T${inicio.hora}`
}

/** Un recordatorio suelto arranca mañana a las 09:00. */
export function valorInicialSuelto(ahora: Date): string {
  return `${sumarDias(aFechaLocal(ahora), 1)}T${HORA_POR_DEFECTO}`
}

/** El instante elegido ya pasó (el aviso saldría enseguida). Un valor vacío o inválido no cuenta. */
export function yaPaso(valor: string, ahora: Date): boolean {
  if (deValorDatetimeLocal(valor) === null) return false
  return parseISO(valor).getTime() <= ahora.getTime()
}

export interface BaseRecordatorio {
  tareaId: number | null
  eventoId: number | null
  canal: Canal
}

/** Sin tarea ni evento, la descripción es lo único que dice el aviso: el backend la exige. */
export function exigeDescripcion(base: Pick<BaseRecordatorio, 'tareaId' | 'eventoId'>): boolean {
  return base.tareaId === null && base.eventoId === null
}

export type ResultadoRequest = { ok: true; request: RecordatorioRequest } | { ok: false; error: string }

/** Cuerpo del PUT que solo cambia la fecha y hora; `tareaId`, `eventoId`, `canal` y descripción se reenvían tal cual. */
export function requestMovido(r: Recordatorio, fechaHora: string): RecordatorioRequest {
  return { tareaId: r.tareaId, eventoId: r.eventoId, fechaHora, canal: r.canal, descripcion: r.descripcion ?? '' }
}

/**
 * Arma el cuerpo completo (el PUT reemplaza todo). Valida antes de llamar al servidor: hora válida y,
 * para un recordatorio suelto, descripción no vacía (se recorta).
 */
export function armarRequest(base: BaseRecordatorio, valor: string, descripcion: string): ResultadoRequest {
  const fechaHora = deValorDatetimeLocal(valor)
  if (fechaHora === null) return { ok: false, error: 'Elige la fecha y la hora del aviso.' }
  const texto = descripcion.trim()
  if (exigeDescripcion(base) && texto === '') {
    return { ok: false, error: 'Escribe una descripción: sin tarea ni evento, es lo único que dirá el aviso.' }
  }
  return { ok: true, request: { tareaId: base.tareaId, eventoId: base.eventoId, fechaHora, canal: base.canal, descripcion: texto } }
}
