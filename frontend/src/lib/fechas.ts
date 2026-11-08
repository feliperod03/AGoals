import { addDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

// Todo el manejo de fechas del frontend vive aquí. Regla: nunca `toISOString()`,
// que convierte a UTC y desplaza el día de la agenda.

const FORMATO_FECHA = 'yyyy-MM-dd'
const FORMATO_FECHA_HORA = "yyyy-MM-dd'T'HH:mm:ss"

/**
 * Formatea un desfase respecto de UTC como `+HH:MM` / `-HH:MM`.
 * `minutos` es el desfase hacia el este (Buenos Aires = -180), al revés que
 * `Date.getTimezoneOffset()`.
 */
export function formatearDesfase(minutos: number): string {
  const signo = minutos < 0 ? '-' : '+'
  const absoluto = Math.abs(minutos)
  const horas = String(Math.floor(absoluto / 60)).padStart(2, '0')
  const resto = String(absoluto % 60).padStart(2, '0')
  return `${signo}${horas}:${resto}`
}

/** Fecha y hora local con desfase, p. ej. `2026-11-10T15:00:00-03:00`. */
export function aIsoConDesfase(fecha: Date): string {
  return format(fecha, FORMATO_FECHA_HORA) + formatearDesfase(-fecha.getTimezoneOffset())
}

/** `2026-11-10` -> `martes, 10 de noviembre de 2026`. */
export function formatearFechaLarga(fecha: string): string {
  return format(parseISO(fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
}

/** `09:30:00` (como llega de la API) -> `09:30`. */
export function formatearHora(hora: string): string {
  return hora.slice(0, 5)
}

/** El día de hoy según el reloj local (`YYYY-MM-DD`), no el de UTC. */
export function hoy(): string {
  return format(new Date(), FORMATO_FECHA)
}

/** El instante actual con desfase local. */
export function ahora(): string {
  return aIsoConDesfase(new Date())
}

/**
 * Rango [00:00 del día, 00:00 del día siguiente) de un día local, para
 * `GET /api/eventos?desde=&hasta=`. El servidor no calcula días: lo manda el cliente.
 */
export function rangoDelDia(fecha: string = hoy()): { desde: string; hasta: string } {
  const inicio = startOfDay(parseISO(fecha))
  return {
    desde: aIsoConDesfase(inicio),
    // addDays opera en calendario local: el día del cambio de horario no mide 24 h.
    hasta: aIsoConDesfase(addDays(inicio, 1)),
  }
}
