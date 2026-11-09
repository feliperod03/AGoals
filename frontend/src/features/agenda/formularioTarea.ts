import { formatearHora } from '@/lib/fechas'
import type { Estado, Prioridad, Tarea, TareaRequest } from '@/types/tarea'

// Lógica pura del formulario de tarea (sin React): valores iniciales, validación y cuerpo a enviar.

export const MAX_TITULO = 200

/** Lo que maneja react-hook-form. Todo texto; '' = vacío. `prioridad` '' = ninguna. */
export interface ValoresTarea {
  titulo: string
  descripcion: string
  prioridad: Prioridad | ''
  fecha: string
  horaInicio: string
  horaFin: string
}

export function valoresIniciales(tarea?: Tarea, fecha = ''): ValoresTarea {
  if (!tarea) {
    return { titulo: '', descripcion: '', prioridad: '', fecha, horaInicio: '', horaFin: '' }
  }
  return {
    titulo: tarea.titulo,
    descripcion: tarea.descripcion ?? '',
    prioridad: tarea.prioridad ?? '',
    fecha: tarea.fecha ?? '',
    horaInicio: tarea.horaInicio ? formatearHora(tarea.horaInicio) : '',
    horaFin: tarea.horaFin ? formatearHora(tarea.horaFin) : '',
  }
}

/**
 * react-hook-form devuelve `undefined` en los campos deshabilitados (las horas sin fecha): todo lo
 * vacío o ausente se trata como null. Sin fecha no hay horas, aunque el estado del formulario las tenga.
 *
 * Al editar (`original`) se reenvían `estado` y `padreId`: el PUT reemplaza todo y, si faltan, la
 * tarea vuelve a PENDIENTE y suelta a su padre. Al crear no se envía `estado` (nace PENDIENTE) y solo
 * se envía `padreId` si se crea una subtarea (`padreId` del tercer parámetro).
 *
 * Al editar, el tercer parámetro es la madre elegida en el formulario: `undefined` = sin tocar (se
 * conserva la original), `null` = sin madre, número = nueva madre.
 */
export function aRequest(valores: Partial<ValoresTarea>, original?: Tarea, padreId?: number | null): TareaRequest {
  const fecha = vacioANull(valores.fecha)
  const request: TareaRequest = {
    titulo: (valores.titulo ?? '').trim(),
    descripcion: vacioANull(valores.descripcion),
    prioridad: vacioANull(valores.prioridad) as Prioridad | null,
    fecha,
    horaInicio: fecha ? vacioANull(valores.horaInicio) : null,
    horaFin: fecha ? vacioANull(valores.horaFin) : null,
  }
  if (original) {
    request.estado = original.estado
    // `padreId` sin definir = campo "Madre" sin tocar: se reenvía la original. `null` = "Sin madre".
    request.padreId = padreId === undefined ? original.padreId : padreId
  } else if (padreId != null) {
    request.padreId = padreId
  }
  return request
}

/**
 * Cuerpo del PUT para cambiar solo el estado (cancelar / reactivar): no hay endpoint propio y el PUT
 * reemplaza todo, así que se reenvían los demás campos tal cual.
 */
export function requestConEstado(tarea: Tarea, estado: Estado): TareaRequest {
  return { ...aRequest(valoresIniciales(tarea), tarea), estado }
}

/**
 * Cuerpo del PUT para dejar una tarea sin fecha (y sin horas), conservando el resto. No es posponer:
 * no pasa por `/posponer`, así que no suma `veces_pospuesta`.
 */
export function requestSinFecha(tarea: Tarea): TareaRequest {
  return { ...requestConEstado(tarea, tarea.estado), fecha: null, horaInicio: null, horaFin: null }
}

/**
 * Cuerpo del PUT para cambiar solo la madre de una tarea (vincularla como subtarea), reenviando todo lo demás.
 * Misma base que `requestConEstado`: el PUT reemplaza todo.
 */
export function requestConPadre(tarea: Tarea, padreId: number | null): TareaRequest {
  return aRequest(valoresIniciales(tarea), tarea, padreId)
}

/** Una tarea abierta (ni hecha ni cancelada) admite que le agreguen subtareas. */
export function puedeAgregarSubtarea(tarea: Tarea): boolean {
  return tarea.estado !== 'HECHO' && tarea.estado !== 'CANCELADO'
}

/** Posponer solo tiene sentido en tareas abiertas con fecha (las sin fecha se agendan desde Recomendación). */
export function puedePosponer(tarea: Tarea): boolean {
  return tarea.fecha !== null && tarea.estado !== 'HECHO' && tarea.estado !== 'CANCELADO'
}

/** "Agendar para hoy" (Cofre): tareas abiertas cuya fecha no es hoy (sin fecha, atrasadas o futuras). */
export function puedeAgendarParaHoy(tarea: Tarea, hoy: string): boolean {
  return tarea.estado !== 'HECHO' && tarea.estado !== 'CANCELADO' && tarea.fecha !== hoy
}

function vacioANull(valor: string | undefined): string | null {
  const limpio = valor?.trim()
  return limpio ? limpio : null
}

/** Validaciones de las horas (HH:mm compara bien como texto). Devuelve el mensaje o undefined si está bien. */
export function validarHoraInicio(horaInicio: string | undefined, horaFin: string | undefined): string | undefined {
  if (horaFin && !horaInicio) return 'Si hay hora de fin, indica también la de inicio'
  return undefined
}

export function validarHoraFin(horaInicio: string | undefined, horaFin: string | undefined): string | undefined {
  if (horaInicio && horaFin && horaFin <= horaInicio) return 'La hora de fin debe ser posterior a la de inicio'
  return undefined
}
