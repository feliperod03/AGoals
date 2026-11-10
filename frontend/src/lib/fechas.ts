import { addDays, differenceInMinutes, format, parseISO, startOfDay } from 'date-fns'
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

/** El día local de una fecha (`YYYY-MM-DD`), no el de UTC. */
export function aFechaLocal(fecha: Date): string {
  return format(fecha, FORMATO_FECHA)
}

/** El día de hoy según el reloj local (`YYYY-MM-DD`), no el de UTC. */
export function hoy(): string {
  return aFechaLocal(new Date())
}

/** `09:30:00` -> minutos desde las 00:00 (570). */
export function minutosDeHora(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
}

/** Minutos desde las 00:00 -> `HH:MM` (1440 -> `24:00`). */
export function formatearMinutos(minutos: number): string {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0')
  const resto = String(minutos % 60).padStart(2, '0')
  return `${horas}:${resto}`
}

/** Minutos desde las 00:00 del día local de `fecha` hasta el instante `instante`. */
export function minutosDelDia(instante: Date, fecha: string): number {
  return differenceInMinutes(instante, startOfDay(parseISO(fecha)))
}

/** ISO con desfase -> `lun 9 nov · 15:00` (hora local). */
export function formatearFechaHoraCorta(iso: string): string {
  return format(parseISO(iso), "EEE d MMM · HH:mm", { locale: es })
}

/**
 * Recorta un evento al día local `fecha`: devuelve su inicio y fin en minutos desde las 00:00
 * (0 a 1440). Un evento que cruza la medianoche se corta en 0 o en 1440. `null` si no toca el día.
 */
export function recortarEventoAlDia(
  evento: { fechaHoraInicio: string; fechaHoraFin: string },
  fecha: string,
): { inicioMin: number; finMin: number } | null {
  const inicioDia = startOfDay(parseISO(fecha))
  const finDia = addDays(inicioDia, 1)
  const inicio = Math.max(parseISO(evento.fechaHoraInicio).getTime(), inicioDia.getTime())
  const fin = Math.min(parseISO(evento.fechaHoraFin).getTime(), finDia.getTime())
  if (fin <= inicio) return null
  return {
    inicioMin: differenceInMinutes(inicio, inicioDia),
    finMin: fin === finDia.getTime() ? 1440 : differenceInMinutes(fin, inicioDia),
  }
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

/** Mensaje de confirmación al guardar una tarea: sin fecha va al cofre. */
export function mensajeGuardada(fecha: string | null): string {
  if (!fecha) return 'Guardada en el cofre'
  return `Guardada para el ${format(parseISO(fecha), "d 'de' MMMM", { locale: es })}`
}

/** Confirmación al crear una subtarea. Sin fecha no aparece en la lista del día: se avisa que está en el Cofre. */
export function mensajeSubtareaAgregada(tituloMadre: string, fecha: string | null): string {
  const base = `Subtarea agregada a «${tituloMadre}»`
  return fecha ? base : `${base}; sin fecha: la verás en el Cofre`
}

/** Confirmación al cambiar la madre: `tituloMadre` null = la tarea quedó sin madre. */
export function mensajeMadreCambiada(titulo: string, tituloMadre: string | null): string {
  return tituloMadre === null ? `«${titulo}» ya no es subtarea` : `«${titulo}» ahora es subtarea de «${tituloMadre}»`
}

/** Confirmación al ligar una tarea a un proyecto u objetivo (`tipo`: «proyecto» / «objetivo»). */
export function mensajeTareaVinculada(titulo: string, tipo: 'proyecto' | 'objetivo', nombre: string): string {
  return `«${titulo}» ahora es del ${tipo} «${nombre}»`
}

/** Confirmación al quitar el vínculo de una tarea con su proyecto u objetivo. */
export function mensajeTareaDesvinculada(titulo: string, tipo: 'proyecto' | 'objetivo', nombre: string): string {
  return `«${titulo}» ya no es del ${tipo} «${nombre}»`
}

/** Confirmación al posponer: `2026-11-10` -> `Pospuesta al 10 de noviembre`. */
export function mensajePospuesta(fecha: string): string {
  return `Pospuesta al ${format(parseISO(fecha), "d 'de' MMMM", { locale: es })}`
}

/** `2026-11-03` -> `3 de noviembre`. */
export function formatearDiaMes(fecha: string): string {
  return format(parseISO(fecha), "d 'de' MMMM", { locale: es })
}

/** Una tarea con fecha anterior a `hoy` está atrasada (las fechas `YYYY-MM-DD` se comparan como texto). */
export function esAtrasada(fecha: string | null, hoy: string): boolean {
  return fecha !== null && fecha < hoy
}

/** Confirmación al agendar para hoy: `subtareas` = subtareas que también se agendaron. */
export function mensajeAgendada(titulo: string, subtareas: number): string {
  const base = `«${titulo}» agendada para hoy`
  if (subtareas <= 0) return base
  return `${base} (con ${subtareas} ${subtareas === 1 ? 'subtarea' : 'subtareas'})`
}

/** Confirmación al borrar una tarea; `subtareas` = total de descendientes y `modo` lo elegido en el diálogo. */
export function mensajeBorrada(titulo: string, subtareas: number, modo?: 'borrar' | 'conservar'): string {
  const base = `«${titulo}» borrada`
  if (!modo || subtareas <= 0) return base
  if (modo === 'borrar') return `${base} con ${subtareas} ${subtareas === 1 ? 'subtarea' : 'subtareas'}`
  return subtareas === 1 ? `${base}; su subtarea se conservó` : `${base}; sus ${subtareas} subtareas se conservaron`
}

/** Compara dos instantes ISO (p. ej. `fechaCreacion`): negativo si `a` es anterior a `b`. */
export function compararFechaHora(a: string, b: string): number {
  return parseISO(a).getTime() - parseISO(b).getTime()
}

/** Suma (o resta) días a una fecha `YYYY-MM-DD` en calendario local. */
export function sumarDias(fecha: string, dias: number): string {
  return format(addDays(parseISO(fecha), dias), FORMATO_FECHA)
}

/** Fecha mínima para posponer: posterior a la de la tarea y posterior a hoy (la mayor de las dos). */
export function fechaMinimaParaPosponer(fechaTarea: string | null, hoy: string): string {
  const manana = sumarDias(hoy, 1)
  if (fechaTarea === null) return manana
  const siguiente = sumarDias(fechaTarea, 1)
  return siguiente > manana ? siguiente : manana
}

/** "Mañana" solo vale si la fecha de la tarea es anterior a mañana (el backend exige una fecha posterior). */
export function puedePosponerAManana(fechaTarea: string | null, hoy: string): boolean {
  return fechaTarea !== null && fechaTarea < sumarDias(hoy, 1)
}

/** Confirmación al dejar una tarea sin fecha. */
export function mensajeSinFecha(): string {
  return 'Sin fecha: la verás en el Cofre y en Recomendación'
}
