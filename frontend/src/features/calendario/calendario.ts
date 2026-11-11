import { calcularRango, finDeTarea, type Rango } from '@/features/agenda/horario'
import {
  diasDeLaSemana,
  duracionEnMinutos,
  esFechaValida,
  formatearDiaSemana,
  formatearMinutos,
  limitesDeSemana,
  mesDe,
  minutosDeHora,
  moverMesConservandoDia,
  parsearMes,
  semanasDelMes,
  sumarDias,
  tramoDelEventoEnDia,
} from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Estado, Prioridad, Tarea } from '@/types/tarea'

// Lógica pura del calendario mensual: reparto de eventos y tareas por día, orden, textos y navegación.

/** Máximo de líneas que cabe en una celda; si hay más, `max - 1` más «+N más». */
export const MAX_POR_CELDA = 3

export type ElementoDia =
  | {
      clave: string
      tipo: 'evento'
      titulo: string
      inicioMin: number
      finMin: number
      empiezaAntes: boolean
      terminaDespues: boolean
      prioridad: Prioridad | null
      evento: Evento
    }
  | {
      clave: string
      tipo: 'tarea'
      titulo: string
      inicioMin: number | null
      finMin: number | null
      estado: Estado
      prioridad: Prioridad | null
      tarea: Tarea
    }

const PESO_PRIORIDAD: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 }

const pesoPrioridad = (p: Prioridad | null) => (p === null ? 3 : PESO_PRIORIDAD[p])

/**
 * Orden dentro de un día: primero lo que tiene hora (eventos y tareas mezclados por minuto de inicio; a igual hora,
 * el evento antes que la tarea y luego por título); después las tareas sin hora por prioridad y por id.
 */
export function ordenarElementos(a: ElementoDia, b: ElementoDia): number {
  const horaA = a.inicioMin
  const horaB = b.inicioMin
  if (horaA !== null && horaB !== null) {
    if (horaA !== horaB) return horaA - horaB
    if (a.tipo !== b.tipo) return a.tipo === 'evento' ? -1 : 1
    return a.titulo.localeCompare(b.titulo, 'es')
  }
  if (horaA !== null) return -1
  if (horaB !== null) return 1
  // Ambos son tareas sin hora (un evento siempre tiene hora).
  const porPrioridad = pesoPrioridad(a.prioridad) - pesoPrioridad(b.prioridad)
  if (porPrioridad !== 0) return porPrioridad
  const idA = a.tipo === 'tarea' ? a.tarea.id : 0
  const idB = b.tipo === 'tarea' ? b.tarea.id : 0
  return idA - idB
}

/**
 * Reparte los eventos (un tramo por cada día de `dias` que tocan) y las tareas con fecha (menos las CANCELADAS)
 * en esos días. Cada lista sale ya ordenada. Las tareas sin fecha o fuera de `dias` no aparecen.
 */
export function elementosPorDia(dias: string[], eventos: Evento[], tareas: Tarea[]): Map<string, ElementoDia[]> {
  const porDia = new Map<string, ElementoDia[]>(dias.map((dia) => [dia, []]))

  for (const tarea of tareas) {
    if (tarea.fecha === null || tarea.estado === 'CANCELADO') continue
    const lista = porDia.get(tarea.fecha)
    if (!lista) continue
    const conHora = tarea.horaInicio !== null
    lista.push({
      clave: `tarea-${tarea.id}`,
      tipo: 'tarea',
      titulo: tarea.titulo,
      inicioMin: conHora ? minutosDeHora(tarea.horaInicio as string) : null,
      finMin: conHora ? finDeTarea(tarea.horaInicio as string, tarea.horaFin) : null,
      estado: tarea.estado,
      prioridad: tarea.prioridad,
      tarea,
    })
  }

  for (const evento of eventos) {
    for (const dia of dias) {
      const tramo = tramoDelEventoEnDia(evento, dia)
      if (!tramo) continue
      porDia.get(dia)?.push({
        clave: `evento-${evento.id}-${dia}`,
        tipo: 'evento',
        titulo: evento.titulo,
        prioridad: evento.prioridad,
        evento,
        ...tramo,
      })
    }
  }

  for (const lista of porDia.values()) lista.sort(ordenarElementos)
  return porDia
}

/** Qué se dibuja en una celda: todo si cabe en `max`; si no, `max - 1` y cuántos quedan ocultos. */
export function recortarParaCelda(elementos: ElementoDia[], max: number = MAX_POR_CELDA): { visibles: ElementoDia[]; ocultos: number } {
  if (elementos.length <= max) return { visibles: elementos, ocultos: 0 }
  return { visibles: elementos.slice(0, max - 1), ocultos: elementos.length - (max - 1) }
}

/** `1440` -> `00:00` (nunca `24:00`). */
const horaDeMinutos = (minutos: number) => formatearMinutos(minutos % 1440)

/**
 * Texto de la hora de un elemento: `09:30–10:00`; `desde 22:00` (primer día de un evento que sigue al día
 * siguiente); `Todo el día` (día intermedio de uno largo, o un tramo de 00:00 a 00:00 del día siguiente); `hasta 02:00` (su último día). Un evento que termina
 * justo a medianoche conserva `22:00–00:00` (1440 min se escribe `00:00`, nunca `24:00`). `null` para una tarea sin hora.
 */
export function textoHora(e: ElementoDia): string | null {
  if (e.inicioMin === null || e.finMin === null) return null
  if (e.tipo === 'tarea') return `${horaDeMinutos(e.inicioMin)}–${horaDeMinutos(e.finMin)}`
  // Ocupa el día entero: intermedio de uno largo, o de 00:00 a 00:00 del día siguiente (nunca «00:00–00:00»).
  if ((e.empiezaAntes && e.terminaDespues) || (e.inicioMin === 0 && e.finMin === 1440)) return 'Todo el día'
  if (e.empiezaAntes) return `hasta ${horaDeMinutos(e.finMin)}`
  if (e.terminaDespues) return `desde ${horaDeMinutos(e.inicioMin)}`
  return `${horaDeMinutos(e.inicioMin)}–${horaDeMinutos(e.finMin)}`
}

/**
 * Hora corta para el chip de una celda: solo el inicio (`09:30`). `null` para una tarea sin hora y para los días de
 * continuación de un evento largo: ahí el chip lleva flecha y título, y «hasta 02:00» / «Todo el día» van en su
 * `title` y en el panel (con `textoHora`).
 */
export function textoHoraCelda(e: ElementoDia): string | null {
  if (e.inicioMin === null) return null
  if (e.tipo === 'evento' && e.empiezaAntes) return null
  return horaDeMinutos(e.inicioMin)
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** `martes 10 de noviembre, hoy, 2 eventos, 3 tareas`. Cuenta las HECHAS; las CANCELADAS ya no llegan aquí. */
export function etiquetaDia(fecha: string, elementos: ElementoDia[], hoy: string): string {
  const partes = [formatearDiaSemana(fecha)]
  if (fecha === hoy) partes.push('hoy')
  const eventos = elementos.filter((e) => e.tipo === 'evento').length
  const tareas = elementos.filter((e) => e.tipo === 'tarea' && e.estado !== 'CANCELADO').length
  if (eventos === 0 && tareas === 0) partes.push('sin elementos')
  if (eventos > 0) partes.push(plural(eventos, 'evento', 'eventos'))
  if (tareas > 0) partes.push(plural(tareas, 'tarea', 'tareas'))
  return partes.join(', ')
}

/** Todas las fechas de la cuadrícula del mes, de corrido. */
export function diasDeLaCuadricula(mes: string): string[] {
  return semanasDelMes(mes).flat()
}

/**
 * Mes y día efectivos según la URL. `mes` inválido o ausente -> el mes de hoy. `dia` inválido o fuera de la
 * cuadrícula visible -> hoy si hoy está en ese mes (si no, el día 1 del mes).
 */
export function estadoDesdeUrl(
  mesParam: string | null,
  diaParam: string | null,
  hoy: string,
): { mes: string; dia: string } {
  const mes = parsearMes(mesParam) ?? mesDe(hoy)
  const visibles = diasDeLaCuadricula(mes)
  if (esFechaValida(diaParam) && visibles.includes(diaParam)) return { mes, dia: diaParam }
  return { mes, dia: mesDe(hoy) === mes ? hoy : `${mes}-01` }
}

/** Día al que lleva una tecla del teclado en la cuadrícula; `null` si la tecla no mueve. */
export function diaDestino(fecha: string, tecla: string): string | null {
  switch (tecla) {
    case 'ArrowLeft':
      return sumarDias(fecha, -1)
    case 'ArrowRight':
      return sumarDias(fecha, 1)
    case 'ArrowUp':
      return sumarDias(fecha, -7)
    case 'ArrowDown':
      return sumarDias(fecha, 7)
    case 'Home':
      return limitesDeSemana(fecha).lunes
    case 'End':
      return limitesDeSemana(fecha).domingo
    case 'PageUp':
      return moverMesConservandoDia(fecha, -1)
    case 'PageDown':
      return moverMesConservandoDia(fecha, 1)
    default:
      return null
  }
}

// --- Vista semanal (rebanada 9b) ---

export type Vista = 'mes' | 'semana'

/** Alto de una hora en la línea de tiempo de la semana (Hoy usa 56: la semana prioriza ver 08–21 sin bajar). */
export const PX_POR_HORA_SEMANA = 48

/** Un evento que dura esto o más va a la franja «Sin hora» en cada día que toca (como hacen otros calendarios). */
export const MINUTOS_EVENTO_LARGO = 24 * 60

/** `semana` -> semana; cualquier otra cosa (ausente, `mes`, basura) -> mes, la vista de 9a. */
export function vistaDesdeUrl(valor: string | null): Vista {
  return valor === 'semana' ? 'semana' : 'mes'
}

/** Día seleccionado y las 7 fechas de su semana. `dia` inválido o ausente -> hoy (sin reescribir la URL). */
export function semanaDesdeUrl(diaParam: string | null, hoy: string): { dia: string; dias: string[] } {
  const dia = esFechaValida(diaParam) ? diaParam : hoy
  return { dia, dias: diasDeLaSemana(dia) }
}

/** Día al que lleva una tecla en los encabezados de la semana; `null` si la tecla no mueve. */
export function diaDestinoSemana(fecha: string, tecla: string): string | null {
  switch (tecla) {
    case 'ArrowLeft':
      return sumarDias(fecha, -1)
    case 'ArrowRight':
      return sumarDias(fecha, 1)
    case 'Home':
      return limitesDeSemana(fecha).lunes
    case 'End':
      return limitesDeSemana(fecha).domingo
    case 'PageUp':
      return sumarDias(fecha, -7)
    case 'PageDown':
      return sumarDias(fecha, 7)
    default:
      return null
  }
}

/** Un elemento que se dibuja en la línea de tiempo: siempre tiene inicio y fin en minutos. */
export type ElementoConHora = ElementoDia & { inicioMin: number; finMin: number }

/** Va a la franja «Sin hora»: una tarea sin hora o un evento que dura 24 h o más (en todos sus días). */
export function esDeFranja(e: ElementoDia): boolean {
  if (e.tipo === 'tarea') return e.inicioMin === null
  return duracionEnMinutos(e.evento.fechaHoraInicio, e.evento.fechaHoraFin) >= MINUTOS_EVENTO_LARGO
}

/** Separa lo de un día en franja y línea de tiempo, conservando el orden de `ordenarElementos`. */
export function repartirDia(elementos: ElementoDia[]): { sinHora: ElementoDia[]; conHora: ElementoConHora[] } {
  const sinHora: ElementoDia[] = []
  const conHora: ElementoConHora[] = []
  for (const e of elementos) {
    if (esDeFranja(e) || e.inicioMin === null || e.finMin === null) sinHora.push(e)
    else conHora.push(e as ElementoConHora)
  }
  return { sinHora, conHora }
}

/** Rango común de las 7 columnas: 08–21 o lo que haga falta para que entre todo lo de la semana. */
export function rangoDeLaSemana(conHoraPorDia: ElementoConHora[][]): Rango {
  return calcularRango(conHoraPorDia.flat())
}

/**
 * Texto para lectores de pantalla de un elemento de la semana, sin el estado (lo pone `EstadoIcono`):
 * `Evento, 09:00–10:00` / `Tarea, sin hora`. La hora visible puede ocultarse por ancho; esta no.
 */
export function tipoYHoraParaLector(e: ElementoDia): string {
  return `${e.tipo === 'evento' ? 'Evento' : 'Tarea'}, ${textoHora(e) ?? 'sin hora'}`
}

/** Texto del `title` de un bloque: `EVENTO · 09:00–10:00 — Reunión`. */
export function tituloDeBloque(e: ElementoDia): string {
  const hora = textoHora(e)
  return `${e.tipo === 'evento' ? 'EVENTO' : 'TAREA'}${hora ? ` · ${hora}` : ''} — ${e.titulo}`
}

/** Alto de una línea de texto de 12 px en los bloques y relleno vertical total del bloque. */
const PX_LINEA = 16
const PX_RELLENO_BLOQUE = 6

/** Cuántas líneas de título caben en un bloque de `altoPx` (al menos 1); `conHora` resta la línea de la hora. */
export function lineasDeTitulo(altoPx: number, conHora: boolean): number {
  const disponible = altoPx - PX_RELLENO_BLOQUE - (conHora ? PX_LINEA : 0)
  return Math.max(1, Math.floor(disponible / PX_LINEA))
}

/** Un bloque con al menos este alto lleva la hora en su propia línea y el título debajo. */
export const ALTO_BLOQUE_CON_DOS_LINEAS = 40

/** Hora corta de un bloque: `09:30`, `desde 22:00` o `hasta 06:00` (un evento cortado por la medianoche). */
export function textoHoraBloque(e: ElementoConHora): string {
  if (e.tipo === 'evento' && e.empiezaAntes) return `hasta ${horaDeMinutos(e.finMin)}`
  if (e.tipo === 'evento' && e.terminaDespues) return `desde ${horaDeMinutos(e.inicioMin)}`
  return horaDeMinutos(e.inicioMin)
}
