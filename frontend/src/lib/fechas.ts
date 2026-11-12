import {
  addDays,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
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
 * ISO con desfase -> `10 nov 2026` (día local). Misma lógica que `formatearFechaHoraCorta`: `parseISO` lleva el
 * instante a la hora local, así que una hora cercana a la medianoche cae en el día que el usuario ve en su reloj.
 */
export function formatearFechaCorta(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: es })
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

// Avisos de confirmación de ideas.
export const mensajeIdeaCreada = (titulo: string) => `Idea «${titulo}» creada`
export const mensajeIdeaGuardada = (titulo: string) => `Idea «${titulo}» guardada`
export const mensajeIdeaConcluida = (titulo: string) => `Idea «${titulo}» concluida`
export const mensajeIdeaReabierta = (titulo: string) => `Idea «${titulo}» reabierta`
export const mensajeIdeaBorrada = (titulo: string) => `Idea «${titulo}» borrada`

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

/** Una tarea con fecha posterior a `hoy` es futura (se comparan como texto, igual que `esAtrasada`). */
export function esFutura(fecha: string | null, hoy: string): boolean {
  return fecha !== null && fecha > hoy
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

/** Formato del valor de un `input type="datetime-local"`: hora local, sin segundos ni zona. */
const FORMATO_DATETIME_LOCAL = "yyyy-MM-dd'T'HH:mm"

/** ISO con desfase -> valor de `datetime-local` en hora local (`2026-11-10T15:00:00-03:00` -> `2026-11-10T15:00`). */
export function aValorDatetimeLocal(iso: string): string {
  return format(parseISO(iso), FORMATO_DATETIME_LOCAL)
}

/**
 * Valor de `datetime-local` -> ISO con desfase de la zona local. `null` si el valor está vacío o no es una fecha
 * válida (el campo del navegador queda vacío mientras se escribe), para no mandar nunca un `Invalid Date`.
 */
export function deValorDatetimeLocal(valor: string): string | null {
  if (valor === '') return null
  const fecha = parseISO(valor)
  return Number.isNaN(fecha.getTime()) ? null : aIsoConDesfase(fecha)
}

/** Confirmaciones de recordatorios; `iso` es la fecha y hora del aviso. */
export const mensajeRecordatorioCreado = (iso: string) => `Recordatorio creado para el ${formatearFechaHoraCorta(iso)}`
export const mensajeRecordatorioGuardado = (iso: string) => `Recordatorio guardado para el ${formatearFechaHoraCorta(iso)}`
export const mensajeRecordatorioQuitado = () => 'Recordatorio quitado'

/** Días de calendario de `desde` a `hasta` (ambas `YYYY-MM-DD`); negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return differenceInCalendarDays(parseISO(hasta), parseISO(desde))
}

/**
 * Corre un instante (ISO con desfase) `dias` días de calendario. `addDays` opera sobre un `Date` local, así que
 * conserva la hora de pared aunque haya un cambio de horario en medio (sumar 24 h en ms la desplazaría).
 */
export function moverInstanteDias(iso: string, dias: number): string {
  return aIsoConDesfase(addDays(parseISO(iso), dias))
}

/** Posponer con el recordatorio acompañando a la tarea. */
export const mensajeRecordatorioMovido = (fechaTarea: string, iso: string) =>
  `${mensajePospuesta(fechaTarea)}; recordatorio movido al ${formatearFechaHoraCorta(iso)}`

/** La tarea se pospuso pero el recordatorio no se pudo mover; `motivo` es el mensaje del servidor. */
export const mensajeRecordatorioNoMovido = (fechaTarea: string, motivo: string) =>
  `${mensajePospuesta(fechaTarea)}, pero no se pudo mover el recordatorio (${motivo}). Revísalo en «Recordatorio…»`

/** «Dejar sin fecha» con un recordatorio pendiente: el recordatorio se queda donde estaba. */
export const mensajeSinFechaConRecordatorio = () => `${mensajeSinFecha()}; el recordatorio no se movió`

// --- Calendario (rebanada 9a) ---

const FORMATO_MES = 'yyyy-MM'
const EXPRESION_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const EXPRESION_FECHA = /^\d{4}-\d{2}-\d{2}$/

/** El mes (`YYYY-MM`) de una fecha `YYYY-MM-DD`. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

/** El mes de hoy según el reloj local (`YYYY-MM`). */
export function mesActual(): string {
  return mesDe(hoy())
}

/** `2026-11` -> `2026-11`; cualquier otra cosa (`2026-13`, `2026-1`, `abc`, `null`) -> `null`. */
export function parsearMes(valor: string | null): string | null {
  return valor !== null && EXPRESION_MES.test(valor) ? valor : null
}

/** `true` solo para una fecha `YYYY-MM-DD` que existe en el calendario (rechaza `2026-02-30`). */
export function esFechaValida(valor: string | null): valor is string {
  if (valor === null || !EXPRESION_FECHA.test(valor)) return false
  const fecha = parseISO(valor)
  return isValid(fecha) && format(fecha, FORMATO_FECHA) === valor
}

/** Suma (o resta) meses a un `YYYY-MM`. */
export function sumarMeses(mes: string, n: number): string {
  return format(addMonths(parseISO(`${mes}-01`), n), FORMATO_MES)
}

/** Las semanas (lunes a domingo) que cubren el mes: 4 a 6 filas de 7 fechas `YYYY-MM-DD`. */
export function semanasDelMes(mes: string): string[][] {
  const primero = parseISO(`${mes}-01`)
  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(primero), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(primero), { weekStartsOn: 1 }),
  }).map(aFechaLocal)
  const semanas: string[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  return semanas
}

/** Rango [00:00 de `primera`, 00:00 del día siguiente a `ultima`) para `GET /api/eventos`. */
export function rangoDeFechas(primera: string, ultima: string): { desde: string; hasta: string } {
  return { desde: rangoDelDia(primera).desde, hasta: rangoDelDia(ultima).hasta }
}

/** `2026-11` -> `Noviembre de 2026`. */
export function formatearMes(mes: string): string {
  const texto = format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** `2026-11-10` -> `martes 10 de noviembre`. */
export function formatearDiaSemana(fecha: string): string {
  return format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })
}

/** El lunes y el domingo de la semana (lunes a domingo) que contiene `fecha`. */
export function limitesDeSemana(fecha: string): { lunes: string; domingo: string } {
  const dia = parseISO(fecha)
  return {
    lunes: aFechaLocal(startOfWeek(dia, { weekStartsOn: 1 })),
    domingo: aFechaLocal(endOfWeek(dia, { weekStartsOn: 1 })),
  }
}

/** Mismo número de día en otro mes, acotado al último día de ese mes (31 ene + 1 mes -> 28 feb). */
export function moverMesConservandoDia(fecha: string, n: number): string {
  return aFechaLocal(addMonths(parseISO(fecha), n))
}

/**
 * Como `recortarEventoAlDia` (que no cambia: la usa `horario.ts`), pero además dice si el evento
 * empezó antes de ese día o sigue después. `null` si no toca el día (los bordes exactos no cuentan).
 */
export function tramoDelEventoEnDia(
  evento: { fechaHoraInicio: string; fechaHoraFin: string },
  fecha: string,
): { inicioMin: number; finMin: number; empiezaAntes: boolean; terminaDespues: boolean } | null {
  const recorte = recortarEventoAlDia(evento, fecha)
  if (!recorte) return null
  const inicioDia = startOfDay(parseISO(fecha))
  return {
    ...recorte,
    empiezaAntes: parseISO(evento.fechaHoraInicio).getTime() < inicioDia.getTime(),
    terminaDespues: parseISO(evento.fechaHoraFin).getTime() > addDays(inicioDia, 1).getTime(),
  }
}

/** Los siete días de la semana empezando por el lunes: `lun` / `lunes`, ... (para el encabezado del calendario). */
export function nombresDiasSemana(): { corto: string; largo: string }[] {
  // 9 de noviembre de 2026 es lunes; solo sirve de referencia para obtener los nombres.
  return Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(parseISO('2026-11-09'), i)
    return { corto: format(dia, 'EEE', { locale: es }), largo: format(dia, 'EEEE', { locale: es }) }
  })
}

// --- Calendario semanal (rebanada 9b) ---

/** Las 7 fechas (lunes a domingo) de la semana que contiene `fecha`. */
export function diasDeLaSemana(fecha: string): string[] {
  const { lunes, domingo } = limitesDeSemana(fecha)
  return eachDayOfInterval({ start: parseISO(lunes), end: parseISO(domingo) }).map(aFechaLocal)
}

/**
 * Título de la semana que empieza el lunes `lunes`: `9–15 de noviembre de 2026`; si cruza el mes,
 * `30 de noviembre – 6 de diciembre de 2026`; si cruza el año, `28 de diciembre de 2026 – 3 de enero de 2027`.
 */
export function formatearRangoSemana(lunes: string): string {
  const inicio = parseISO(lunes)
  const fin = addDays(inicio, 6)
  const conLocale = (fecha: Date, patron: string) => format(fecha, patron, { locale: es })
  if (inicio.getFullYear() !== fin.getFullYear()) {
    return `${conLocale(inicio, "d 'de' MMMM 'de' yyyy")} – ${conLocale(fin, "d 'de' MMMM 'de' yyyy")}`
  }
  if (inicio.getMonth() !== fin.getMonth()) {
    return `${conLocale(inicio, "d 'de' MMMM")} – ${conLocale(fin, "d 'de' MMMM 'de' yyyy")}`
  }
  return `${conLocale(inicio, 'd')}–${conLocale(fin, "d 'de' MMMM 'de' yyyy")}`
}

/** Minutos entre dos instantes ISO con desfase (la duración real, aunque cruce un cambio de horario). */
export function duracionEnMinutos(inicioIso: string, finIso: string): number {
  return differenceInMinutes(parseISO(finIso), parseISO(inicioIso))
}

/** `2026-11-09` -> `lunes 9` (nombre corto del encabezado de un día en la semana). */
export function formatearDiaCorto(fecha: string): string {
  return format(parseISO(fecha), 'EEEE d', { locale: es })
}

// --- Eventos (rebanada 9c) ---

/** Un día (`YYYY-MM-DD`) y una hora (`HH:mm`) locales, como los dan los `<input type="date">` y `type="time"`. */
export interface FechaYHora {
  fecha: string
  hora: string
}

const EXPRESION_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** `true` para `HH:mm` (o `HH:mm:ss`, que algunos navegadores dan con `step`); `false` para vacío o inválido. */
export function esHoraValida(valor: string): boolean {
  return EXPRESION_HORA.test(valor)
}

/** ISO con desfase -> día y hora en la zona local (`{ fecha: '2026-12-15', hora: '09:00' }`). Sin segundos. */
export function partesLocales(iso: string): FechaYHora {
  const fecha = parseISO(iso)
  return { fecha: format(fecha, FORMATO_FECHA), hora: format(fecha, 'HH:mm') }
}

/** Día y hora locales -> `Date`; `null` si alguno está vacío o es inválido. */
function aDateLocal({ fecha, hora }: FechaYHora): Date | null {
  if (!esFechaValida(fecha) || !esHoraValida(hora)) return null
  return parseISO(`${fecha}T${hora.slice(0, 5)}`)
}

/** Día y hora locales -> ISO con desfase de la zona local; `null` si alguno está vacío o es inválido. */
export function deFechaYHoraLocal(fecha: string, hora: string): string | null {
  const instante = aDateLocal({ fecha, hora })
  return instante ? aIsoConDesfase(instante) : null
}

/** Minutos de `inicio` a `fin` (negativo si `fin` es anterior); `null` si alguno es inválido. */
export function minutosEntre(inicio: FechaYHora, fin: FechaYHora): number | null {
  const a = aDateLocal(inicio)
  const b = aDateLocal(fin)
  return a && b ? differenceInMinutes(b, a) : null
}

/** Corre un día y hora locales `minutos` minutos (puede cambiar de día); `null` si el punto de partida es inválido. */
export function sumarMinutos(punto: FechaYHora, minutos: number): FechaYHora | null {
  const instante = aDateLocal(punto)
  if (!instante) return null
  const nuevo = addMinutes(instante, minutos)
  return { fecha: format(nuevo, FORMATO_FECHA), hora: format(nuevo, 'HH:mm') }
}

/**
 * Un evento que ocupa días enteros: empieza y termina a las 00:00 locales (de 00:00 a 00:00 del día siguiente, o
 * varios días así). Es lo que el formulario guarda con «Todo el día» y lo que el calendario muestra como «Todo el día».
 */
export function esDeDiasCompletos(inicioIso: string, finIso: string): boolean {
  const inicio = parseISO(inicioIso)
  const fin = parseISO(finIso)
  return fin.getTime() > inicio.getTime() && inicio.getTime() === startOfDay(inicio).getTime() && fin.getTime() === startOfDay(fin).getTime()
}

/**
 * Texto corto del lapso de un evento, en hora local. Nunca escribe «24:00»: un evento que termina a la medianoche
 * siguiente se escribe «22:00–00:00».
 * - `mar 15 dic, 09:00–10:00` (o hasta las 00:00 del día siguiente);
 * - `mar 15 dic, todo el día` / `del mié 2 dic al vie 4 dic` (días completos);
 * - `del mié 9 dic, 22:00 al jue 10 dic, 02:00`.
 */
export function formatearRangoEvento(inicioIso: string, finIso: string): string {
  const dia = (fecha: Date) => format(fecha, 'EEE d MMM', { locale: es })
  const hora = (fecha: Date) => format(fecha, 'HH:mm')
  const inicio = parseISO(inicioIso)
  const fin = parseISO(finIso)
  if (esDeDiasCompletos(inicioIso, finIso)) {
    const ultimo = addDays(fin, -1)
    return differenceInCalendarDays(ultimo, inicio) === 0 ? `${dia(inicio)}, todo el día` : `del ${dia(inicio)} al ${dia(ultimo)}`
  }
  const terminaALaMedianoche = fin.getTime() === addDays(startOfDay(inicio), 1).getTime()
  if (differenceInCalendarDays(fin, inicio) === 0 || terminaALaMedianoche) {
    return `${dia(inicio)}, ${hora(inicio)}–${hora(fin)}`
  }
  return `del ${dia(inicio)}, ${hora(inicio)} al ${dia(fin)}, ${hora(fin)}`
}

/** Confirmaciones de eventos (aviso de la página). */
export const mensajeEventoCreado = (titulo: string, inicioIso: string, finIso: string) =>
  `Evento «${titulo}» creado (${formatearRangoEvento(inicioIso, finIso)})`
export const mensajeEventoGuardado = (titulo: string, inicioIso: string, finIso: string) =>
  `Evento «${titulo}» guardado (${formatearRangoEvento(inicioIso, finIso)})`
export const mensajeEventoBorrado = (titulo: string, conRecordatorio: boolean) =>
  `Evento «${titulo}» borrado${conRecordatorio ? ', con su recordatorio' : ''}`
export const mensajeEventoYaNoExistia = (titulo: string) => `El evento «${titulo}» ya no existía`

/** Guardar el evento con otro inicio y el recordatorio acompañándolo (9e). */
export const mensajeEventoGuardadoConRecordatorio = (titulo: string, inicioIso: string, finIso: string, recordatorioIso: string) =>
  `${mensajeEventoGuardado(titulo, inicioIso, finIso)}; recordatorio movido al ${formatearFechaHoraCorta(recordatorioIso)}`

/** El evento se guardó pero el recordatorio no se pudo mover; `motivo` es el mensaje del servidor. */
export const mensajeEventoRecordatorioNoMovido = (titulo: string, inicioIso: string, finIso: string, motivo: string) =>
  `${mensajeEventoGuardado(titulo, inicioIso, finIso)}, pero no se pudo mover el recordatorio (${motivo}). Revísalo en «Recordatorio…»`

/** Nota del diálogo de edición cuando no se pudo consultar el recordatorio y el inicio cambió. */
export const notaRecordatorioEventoNoConsultado = () => 'No se pudo consultar el recordatorio de este evento: si tiene uno, no se moverá.'

/** Línea del diálogo de recordatorio de un evento: cuándo empieza (de días completos, el lapso, porque «00:00» confunde). */
export const mensajeEventoEmpieza = (inicioIso: string, finIso: string) =>
  esDeDiasCompletos(inicioIso, finIso)
    ? `El evento es ${formatearRangoEvento(inicioIso, finIso)}`
    : `El evento empieza el ${formatearFechaHoraCorta(inicioIso)}`
