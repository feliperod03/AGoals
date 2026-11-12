import { HORA_POR_DEFECTO } from '@/features/agenda/recordatorioForm'
import {
  deFechaYHoraLocal,
  esDeDiasCompletos,
  esFechaValida,
  formatearMinutos,
  minutosEntre,
  partesLocales,
  sumarDias,
  sumarMinutos,
} from '@/lib/fechas'
import type { Evento, EventoRequest } from '@/types/evento'
import type { Prioridad } from '@/types/tarea'

// Lógica pura del formulario de eventos (9c): valores por defecto, «Todo el día», validación y cuerpo del POST/PUT.

/** El límite del backend (`@Size(max = 200)`), medido sobre el título ya recortado. */
export const MAX_TITULO = 200

/** Duración de un evento nuevo. */
export const DURACION_POR_DEFECTO_MIN = 60

/**
 * Lo que maneja react-hook-form. Todo texto; `prioridad` '' = ninguna.
 * - Con hora: inicio = `fechaInicio horaInicio`, fin = `fechaFin horaFin` (un fin a la medianoche es el día
 *   siguiente a las 00:00, nunca «24:00»).
 * - Con «Todo el día»: `fechaInicio` es el primer día y `fechaFin` el ÚLTIMO día (inclusivo). Las horas quedan
 *   guardadas (ocultas) por si se desmarca la casilla.
 */
export interface ValoresEvento {
  titulo: string
  descripcion: string
  prioridad: Prioridad | ''
  todoElDia: boolean
  fechaInicio: string
  horaInicio: string
  fechaFin: string
  horaFin: string
}

const MINUTOS_DIA = 1440

/** Valores de un evento nuevo que empieza `inicioMin` minutos después de las 00:00 de `dia` y dura 1 h (sin pasar las 00:00 siguientes). */
function nuevoDesde(dia: string, inicioMin: number): ValoresEvento {
  const finMin = Math.min(inicioMin + DURACION_POR_DEFECTO_MIN, MINUTOS_DIA)
  return {
    titulo: '',
    descripcion: '',
    prioridad: '',
    todoElDia: false,
    fechaInicio: dia,
    horaInicio: formatearMinutos(inicioMin),
    fechaFin: finMin === MINUTOS_DIA ? sumarDias(dia, 1) : dia,
    horaFin: finMin === MINUTOS_DIA ? '00:00' : formatearMinutos(finMin),
  }
}

/**
 * Evento nuevo desde «Nuevo evento» para el día `dia`.
 * - Otro día que hoy: 09:00–10:00.
 * - Hoy: empieza en la hora en punto posterior a `ahora` (14:20 → 15:00; 14:00 justo → 15:00) y dura 1 h.
 *   De 23:00 a 23:59 no hay otra hora en punto en el día: queda 23:00–00:00 del día siguiente (ya empezado, se permite).
 */
export function valoresParaNuevo(dia: string, hoy: string, ahora: Date): ValoresEvento {
  if (dia !== hoy) return nuevoDesde(dia, Number(HORA_POR_DEFECTO.slice(0, 2)) * 60)
  const siguiente = ahora.getHours() + 1
  return nuevoDesde(dia, Math.min(siguiente, 23) * 60)
}

/** Evento nuevo desde un hueco de la semana: empieza en `minutos` de `dia` y dura 1 h (como mucho hasta las 00:00 del día siguiente). */
export function valoresParaHueco(dia: string, minutos: number): ValoresEvento {
  return nuevoDesde(dia, minutos)
}

/** Evento nuevo de todo el día `dia` (desde un hueco de la franja «Sin hora»). Las horas ocultas quedan en 09:00–10:00. */
export function valoresTodoElDia(dia: string): ValoresEvento {
  return { ...nuevoDesde(dia, 9 * 60), todoElDia: true }
}

/** El evento ocupa días enteros (de 00:00 a 00:00 locales): se abre con «Todo el día» marcado. */
export function esTodoElDia(evento: Pick<Evento, 'fechaHoraInicio' | 'fechaHoraFin'>): boolean {
  return esDeDiasCompletos(evento.fechaHoraInicio, evento.fechaHoraFin)
}

/**
 * Empieza y termina en días distintos (sin contar un fin a las 00:00 del día siguiente, que es el mismo día hasta la
 * medianoche). El diálogo avisa que los cambios valen para todo el evento.
 */
export function esDeVariosDias(evento: Pick<Evento, 'fechaHoraInicio' | 'fechaHoraFin'>): boolean {
  const inicio = partesLocales(evento.fechaHoraInicio)
  const fin = partesLocales(evento.fechaHoraFin)
  const ultimoDia = fin.hora === '00:00' ? sumarDias(fin.fecha, -1) : fin.fecha
  return ultimoDia > inicio.fecha
}

/** Valores para editar `evento`, en hora local. Un evento de días completos abre con «Todo el día» y horas 09:00–10:00 ocultas. */
export function valoresIniciales(evento: Evento): ValoresEvento {
  const inicio = partesLocales(evento.fechaHoraInicio)
  const fin = partesLocales(evento.fechaHoraFin)
  const base = {
    titulo: evento.titulo,
    descripcion: evento.descripcion ?? '',
    prioridad: evento.prioridad ?? '',
  } as const
  if (esTodoElDia(evento)) {
    return { ...base, todoElDia: true, fechaInicio: inicio.fecha, horaInicio: '09:00', fechaFin: sumarDias(fin.fecha, -1), horaFin: '10:00' }
  }
  return { ...base, todoElDia: false, fechaInicio: inicio.fecha, horaInicio: inicio.hora, fechaFin: fin.fecha, horaFin: fin.hora }
}

/**
 * Marca o desmarca «Todo el día» sin perder lo elegido.
 * - Al marcar: el último día es el del fin (o el anterior si el fin es a las 00:00), nunca antes del primero.
 * - Al desmarcar: vuelven las horas ocultas; un `horaFin` de 00:00 cae el día siguiente al último. Si así el fin no
 *   queda después del inicio, dura 1 h desde el inicio.
 */
export function alternarTodoElDia(valores: ValoresEvento, activar: boolean): ValoresEvento {
  if (activar === valores.todoElDia) return valores
  if (activar) {
    const valido = esFechaValida(valores.fechaFin)
    let ultimo = valido && valores.horaFin === '00:00' && valores.fechaFin > valores.fechaInicio ? sumarDias(valores.fechaFin, -1) : valores.fechaFin
    if (!valido || ultimo < valores.fechaInicio) ultimo = valores.fechaInicio
    return { ...valores, todoElDia: true, fechaFin: ultimo }
  }
  const fechaFin = valores.horaFin === '00:00' && esFechaValida(valores.fechaFin) ? sumarDias(valores.fechaFin, 1) : valores.fechaFin
  const conHoras = { ...valores, todoElDia: false, fechaFin }
  const inicio = { fecha: conHoras.fechaInicio, hora: conHoras.horaInicio }
  const duracion = minutosEntre(inicio, { fecha: conHoras.fechaFin, hora: conHoras.horaFin })
  if (duracion !== null && duracion > 0) return conHoras
  const fin = sumarMinutos(inicio, DURACION_POR_DEFECTO_MIN)
  return fin ? { ...conHoras, fechaFin: fin.fecha, horaFin: fin.hora } : conHoras
}

/**
 * Al cambiar el inicio, el fin se corre conservando la duración que había (con «Todo el día», la cantidad de días).
 * Devuelve el fin nuevo, o `null` si no se puede calcular (algún campo vacío o inválido, o una duración que no era
 * positiva): entonces el fin no se toca y la validación dirá qué falta.
 */
export function moverFinConservandoDuracion(anterior: ValoresEvento, nuevo: ValoresEvento): { fechaFin: string; horaFin: string } | null {
  if (anterior.todoElDia) {
    if (![anterior.fechaInicio, anterior.fechaFin, nuevo.fechaInicio].every((f) => esFechaValida(f))) return null
    const dias = minutosEntre({ fecha: anterior.fechaInicio, hora: '00:00' }, { fecha: anterior.fechaFin, hora: '00:00' })
    if (dias === null || dias < 0) return null
    const fin = sumarMinutos({ fecha: nuevo.fechaInicio, hora: '00:00' }, dias)
    return fin ? { fechaFin: fin.fecha, horaFin: anterior.horaFin } : null
  }
  const duracion = minutosEntre(
    { fecha: anterior.fechaInicio, hora: anterior.horaInicio },
    { fecha: anterior.fechaFin, hora: anterior.horaFin },
  )
  if (duracion === null || duracion <= 0) return null
  const fin = sumarMinutos({ fecha: nuevo.fechaInicio, hora: nuevo.horaInicio }, duracion)
  return fin ? { fechaFin: fin.fecha, horaFin: fin.hora } : null
}

/** Errores por campo: `inicio` va junto a los campos de inicio y `fin` junto a los de fin. */
export interface ErroresEvento {
  titulo?: string
  inicio?: string
  fin?: string
}

export function validarTitulo(titulo: string): string | undefined {
  const recortado = titulo.trim()
  if (!recortado) return 'El título es obligatorio'
  if (recortado.length > MAX_TITULO) return `El título admite como máximo ${MAX_TITULO} caracteres`
  return undefined
}

/** Los dos instantes que se mandarían (ISO con desfase), o los errores de fecha y hora. */
type Lapso = { ok: true; inicio: string; fin: string } | { ok: false; errores: ErroresEvento }

function lapsoDe(v: ValoresEvento): Lapso {
  const errores: ErroresEvento = {}
  if (v.todoElDia) {
    const inicio = esFechaValida(v.fechaInicio) ? deFechaYHoraLocal(v.fechaInicio, '00:00') : null
    const fin = esFechaValida(v.fechaFin) ? deFechaYHoraLocal(sumarDias(v.fechaFin, 1), '00:00') : null
    if (!inicio) errores.inicio = 'Indica el primer día'
    if (!fin) errores.fin = 'Indica el último día'
    else if (inicio && v.fechaFin < v.fechaInicio) errores.fin = 'El último día no puede ser anterior al primero'
    return inicio && fin && !errores.fin ? { ok: true, inicio, fin } : { ok: false, errores }
  }
  const inicio = deFechaYHoraLocal(v.fechaInicio, v.horaInicio)
  const fin = deFechaYHoraLocal(v.fechaFin, v.horaFin)
  if (!inicio) errores.inicio = 'Indica el día y la hora de inicio'
  if (!fin) errores.fin = 'Indica el día y la hora de fin'
  if (inicio && fin) {
    const duracion = minutosEntre({ fecha: v.fechaInicio, hora: v.horaInicio }, { fecha: v.fechaFin, hora: v.horaFin })
    if (duracion !== null && duracion > 0) return { ok: true, inicio, fin }
    errores.fin = 'El fin debe ser posterior al inicio'
  }
  return { ok: false, errores }
}

/**
 * Valida y arma el cuerpo del POST/PUT: SIEMPRE los cinco campos (el PUT reemplaza todo). Título y descripción
 * recortados (descripción vacía = `""`, como la guarda el backend); prioridad '' = null. Con «Todo el día»:
 * 00:00 del primer día a 00:00 del día siguiente al último.
 */
export function aRequestEvento(valores: ValoresEvento): { ok: true; request: EventoRequest } | { ok: false; errores: ErroresEvento } {
  const errorTitulo = validarTitulo(valores.titulo)
  const lapso = lapsoDe(valores)
  if (errorTitulo || !lapso.ok) {
    return { ok: false, errores: { ...(errorTitulo ? { titulo: errorTitulo } : {}), ...(lapso.ok ? {} : lapso.errores) } }
  }
  return {
    ok: true,
    request: {
      titulo: valores.titulo.trim(),
      descripcion: valores.descripcion.trim(),
      fechaHoraInicio: lapso.inicio,
      fechaHoraFin: lapso.fin,
      prioridad: valores.prioridad === '' ? null : valores.prioridad,
    },
  }
}
