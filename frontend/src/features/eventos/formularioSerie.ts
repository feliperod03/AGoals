import {
  diaSemanaDe,
  diasDelMes,
  duracionEnMinutos,
  esFechaValida,
  esHoraValida,
  formatearDiaDeSerie,
  limitesDeSemana,
  mesDe,
  minutosEntre,
  sumarDias,
  sumarMeses,
} from '@/lib/fechas'
import type { DiaSemana, Frecuencia, SerieEventoRequest } from '@/types/serie'
import { validarTitulo, type ErroresEvento, type ValoresEvento } from './formularioEvento'

// Lógica pura del formulario «Repetir» (crear una serie): valores por defecto, generador de fechas del cliente,
// validación y cuerpo del POST /api/series-eventos. Sin Spring ni reloj: «hoy» sale SIEMPRE de la misma `ahora` (ISO con
// desfase) que viaja en el request, así la vista previa, los tests y el servidor cuentan desde el mismo día.

/** Tope del backend (`GeneradorOcurrencias.TOPE`): más ocurrencias = 400, nunca se recorta. */
export const TOPE_OCURRENCIAS = 260

export const MINUTOS_MAX_RECORDATORIO = 10080
export const MINUTOS_POR_DEFECTO = 60
const REPETICIONES_POR_DEFECTO = 10

/** Orden de la semana (lunes primero), con su letra visible y su nombre completo. */
export const DIAS_SEMANA: { dia: DiaSemana; letra: string; nombre: string }[] = [
  { dia: 'LUNES', letra: 'L', nombre: 'lunes' },
  { dia: 'MARTES', letra: 'M', nombre: 'martes' },
  { dia: 'MIERCOLES', letra: 'X', nombre: 'miércoles' },
  { dia: 'JUEVES', letra: 'J', nombre: 'jueves' },
  { dia: 'VIERNES', letra: 'V', nombre: 'viernes' },
  { dia: 'SABADO', letra: 'S', nombre: 'sábado' },
  { dia: 'DOMINGO', letra: 'D', nombre: 'domingo' },
]

export type Repetir = 'no' | Frecuencia

/** Lo que maneja el sub-formulario «Repetir». Todo texto o booleano; `repetir: 'no'` = evento suelto. */
export interface ValoresSerie {
  repetir: Repetir
  diasSemana: DiaSemana[]
  intervaloSemanas: '1' | '2'
  diaMes: string
  final: 'repeticiones' | 'hasta'
  repeticiones: string
  hasta: string
  conRecordatorio: boolean
  minutosAntes: string
}

/** Valores de «Repetir» para un evento que empieza el día `fechaInicio`: el día de la semana y del mes de esa fecha. */
export function valoresSerieIniciales(fechaInicio: string): ValoresSerie {
  const valida = esFechaValida(fechaInicio)
  return {
    repetir: 'no',
    diasSemana: valida ? [diaSemanaDe(fechaInicio)] : [],
    intervaloSemanas: '1',
    diaMes: valida ? String(Number(fechaInicio.slice(8, 10))) : '1',
    final: 'repeticiones',
    repeticiones: String(REPETICIONES_POR_DEFECTO),
    // Fecha final sugerida (si se elige «El día»): unos tres meses después.
    hasta: valida ? sumarDias(fechaInicio, 90) : '',
    conRecordatorio: false,
    minutosAntes: String(MINUTOS_POR_DEFECTO),
  }
}

/**
 * Al volver a «No se repite» se restauran el día de inicio y el de fin que tenía el formulario antes de repetir (en
 * modo serie esos campos no se muestran). Las horas quedan como se editaron; si con ellas el fin no queda después del
 * inicio, el fin pasa al día siguiente (lo mismo que decía «Termina al día siguiente»).
 */
export function volverASuelto(
  actuales: Pick<ValoresEvento, 'horaInicio' | 'horaFin'>,
  previos: Pick<ValoresEvento, 'fechaInicio' | 'fechaFin'>,
): Pick<ValoresEvento, 'fechaInicio' | 'fechaFin'> {
  const duracion = minutosEntre(
    { fecha: previos.fechaInicio, hora: actuales.horaInicio },
    { fecha: previos.fechaFin, hora: actuales.horaFin },
  )
  if (duracion === null || duracion > 0) return { ...previos }
  return { fechaInicio: previos.fechaInicio, fechaFin: sumarDias(previos.fechaInicio, 1) }
}

// --- Generador de fechas ---

/** La regla ya interpretada (números, no textos). Un solo final: `hasta` o `repeticiones`. */
export interface ReglaSerie {
  frecuencia: Frecuencia
  dias: DiaSemana[]
  intervalo: 1 | 2
  diaMes: number
  hasta?: string
  repeticiones?: number
}

/** El día `YYYY-MM-DD` de `hoy` según la misma `ahora` que viaja en el request (el desfase ya es el local). */
export const hoyDe = (ahoraIso: string): string => ahoraIso.slice(0, 10)

/**
 * Las fechas de la regla desde `hoy` (incluido), en orden: copia de `GeneradorOcurrencias.fechas` del backend.
 * Semanal: «cada 2 semanas» se cuenta desde la semana (lunes a domingo) de la primera ocurrencia. Mensual: si el mes no
 * tiene el día, el último (ajuste por mes, no acumulado). Corta al llegar a `tope` (por defecto el tope + 1: basta para
 * saber que se pasa) para no iterar de más. Sin final o sin días devuelve `[]`.
 */
export function fechasDeSerie(regla: ReglaSerie, hoy: string, tope: number = TOPE_OCURRENCIAS + 1): string[] {
  if (regla.hasta === undefined && regla.repeticiones === undefined) return []
  const fechas: string[] = []

  /** Suma la fecha si todavía entra; `false` = hay que parar. */
  const agregar = (d: string): boolean => {
    if (regla.hasta !== undefined && d > regla.hasta) return false
    if (fechas.length >= tope) return false
    fechas.push(d)
    return regla.repeticiones === undefined || fechas.length < regla.repeticiones
  }

  if (regla.frecuencia === 'SEMANAL') {
    if (regla.dias.length === 0) return []
    let primera = hoy
    while (!regla.dias.includes(diaSemanaDe(primera))) primera = sumarDias(primera, 1)
    let lunes = limitesDeSemana(primera).lunes
    for (;;) {
      for (let i = 0; i < 7; i++) {
        const d = sumarDias(lunes, i)
        if (d < hoy || !regla.dias.includes(diaSemanaDe(d))) continue
        if (!agregar(d)) return fechas
      }
      lunes = sumarDias(lunes, 7 * regla.intervalo)
    }
  }

  let mes = mesDe(hoy)
  for (;;) {
    const dia = Math.min(regla.diaMes, diasDelMes(mes))
    const d = `${mes}-${String(dia).padStart(2, '0')}`
    if (d >= hoy && !agregar(d)) return fechas
    mes = sumarMeses(mes, 1)
  }
}

// --- Validación ---

/** Errores de «Repetir» por campo (cada uno va junto a su control). */
export interface ErroresSerie {
  /** Semanal sin ningún día. */
  dias?: string
  diaMes?: string
  /** Todo lo del final: repeticiones o fecha fuera de rango, ninguna ocurrencia, más del tope. */
  final?: string
  /** Horas faltantes, inválidas o iguales (todo el día no se repite). */
  horas?: string
  minutos?: string
}

const ENTERO = /^\d+$/

/** `repeticiones`/`diaMes`/`minutos` como número, o `null` si no es un entero positivo (o cero) escrito con dígitos. */
const aEntero = (texto: string): number | null => (ENTERO.test(texto.trim()) ? Number(texto.trim()) : null)

/** La regla interpretada, o `null` si falta o es inválido algo de lo que depende (los errores los da `validarSerie`). */
function reglaDe(serie: ValoresSerie): ReglaSerie | null {
  if (serie.repetir === 'no') return null
  const diaMes = aEntero(serie.diaMes)
  if (serie.repetir === 'MENSUAL' && (diaMes === null || diaMes < 1 || diaMes > 31)) return null
  if (serie.repetir === 'SEMANAL' && serie.diasSemana.length === 0) return null
  const base = {
    frecuencia: serie.repetir,
    dias: serie.diasSemana,
    intervalo: serie.intervaloSemanas === '2' ? (2 as const) : (1 as const),
    diaMes: diaMes ?? 1,
  }
  if (serie.final === 'hasta') return esFechaValida(serie.hasta) ? { ...base, hasta: serie.hasta } : null
  const repeticiones = aEntero(serie.repeticiones)
  return repeticiones !== null && repeticiones >= 1 && repeticiones <= TOPE_OCURRENCIAS ? { ...base, repeticiones } : null
}

export type FechasDeSerie = { ok: true; fechas: string[] } | { ok: false; errores: ErroresSerie }

/**
 * Valida «Repetir» y calcula las fechas. Textos: los mismos motivos por los que el servidor daría 400, para no llegar
 * a él cuando se puede evitar. `hoy` sale de la `ahora` del request.
 */
export function calcularSerie(serie: ValoresSerie, horaInicio: string, horaFin: string, hoy: string, todoElDia = false): FechasDeSerie {
  const errores: ErroresSerie = {}
  if (todoElDia) errores.horas = 'Los eventos de todo el día no se pueden repetir'
  else if (!esHoraValida(horaInicio)) errores.horas = 'Indica la hora de inicio'
  else if (!esHoraValida(horaFin)) errores.horas = 'Indica la hora de fin'
  else if (horaInicio.slice(0, 5) === horaFin.slice(0, 5)) errores.horas = 'La hora de fin debe ser distinta de la de inicio'

  if (serie.repetir === 'SEMANAL' && serie.diasSemana.length === 0) errores.dias = 'Elige al menos un día de la semana'
  if (serie.repetir === 'MENSUAL') {
    const dia = aEntero(serie.diaMes)
    if (dia === null || dia < 1 || dia > 31) errores.diaMes = 'Indica un día del mes entre 1 y 31'
  }

  if (serie.final === 'repeticiones') {
    const n = aEntero(serie.repeticiones)
    if (n === null || n < 1 || n > TOPE_OCURRENCIAS) errores.final = `Indica entre 1 y ${TOPE_OCURRENCIAS} veces`
  } else if (!esFechaValida(serie.hasta)) {
    errores.final = 'Indica la fecha final'
  } else if (serie.hasta < hoy) {
    errores.final = 'La fecha final no puede ser anterior a hoy'
  }

  if (serie.conRecordatorio) {
    const m = aEntero(serie.minutosAntes)
    if (m === null || m > MINUTOS_MAX_RECORDATORIO) errores.minutos = `Indica entre 0 y ${MINUTOS_MAX_RECORDATORIO} minutos`
  }

  const regla = reglaDe(serie)
  if (!errores.final && regla) {
    const fechas = fechasDeSerie(regla, hoy)
    if (fechas.length === 0) errores.final = `No hay ninguna fecha entre hoy y el ${formatearDiaDeSerie(regla.hasta ?? hoy)}`
    else if (fechas.length > TOPE_OCURRENCIAS) {
      errores.final = `Serían más de ${TOPE_OCURRENCIAS} eventos, que es el máximo: elige un final más cercano`
    } else if (Object.keys(errores).length === 0) return { ok: true, fechas }
  }
  return { ok: false, errores }
}

/** Línea de la vista previa: cuántos eventos se crean y entre qué días; avisa si la serie cuenta desde hoy y no desde el día elegido. */
export function textoVistaPrevia(fechas: string[], hoy: string, diaElegido: string): string {
  const cantidad = fechas.length
  const primera = fechas[0] as string
  const ultima = fechas[cantidad - 1] as string
  const lapso = cantidad === 1 ? `el ${formatearDiaDeSerie(primera)}` : `del ${formatearDiaDeSerie(primera)} al ${formatearDiaDeSerie(ultima)}`
  const resumen = `Se ${cantidad === 1 ? 'creará 1 evento' : `crearán ${cantidad} eventos`}, ${lapso}.`
  // El aviso solo importa si el día elegido no es la primera ocurrencia (ahí el usuario ya ve lo que esperaba).
  return diaElegido !== hoy && diaElegido !== primera && esFechaValida(diaElegido)
    ? `${resumen} La serie cuenta desde hoy, no desde el ${formatearDiaDeSerie(diaElegido)}.`
    : resumen
}

// --- Request ---

/** Cuántos minutos antes de `inicioIso` cae `recordatorioIso`, o `null` si no cabe en el rango de la serie (0..10080). */
export function minutosAntesDe(inicioIso: string, recordatorioIso: string): number | null {
  const minutos = duracionEnMinutos(recordatorioIso, inicioIso)
  return Number.isInteger(minutos) && minutos >= 0 && minutos <= MINUTOS_MAX_RECORDATORIO ? minutos : null
}

export type ResultadoSerie =
  | { ok: true; request: SerieEventoRequest; fechas: string[] }
  | { ok: false; errores: ErroresEvento; erroresSerie: ErroresSerie }

/**
 * Valida el título y «Repetir» y arma el cuerpo del POST. `ahora` (ISO con desfase) y `zona` (id IANA) los pone quien
 * llama: de ahí sale «hoy» tanto para la vista previa como para el servidor. Solo viaja lo que corresponde a la
 * frecuencia (semanal: días e intervalo, sin `diaMes`; mensual: solo `diaMes`) y un único final.
 */
export function aRequestSerie(
  valores: ValoresEvento,
  serie: ValoresSerie,
  { ahora, zona }: { ahora: string; zona: string },
): ResultadoSerie {
  const errorTitulo = validarTitulo(valores.titulo)
  const calculo = calcularSerie(serie, valores.horaInicio, valores.horaFin, hoyDe(ahora), valores.todoElDia)
  const regla = reglaDe(serie)
  if (errorTitulo || !calculo.ok || !regla || serie.repetir === 'no') {
    return { ok: false, errores: errorTitulo ? { titulo: errorTitulo } : {}, erroresSerie: calculo.ok ? {} : calculo.errores }
  }
  const request: SerieEventoRequest = {
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    prioridad: valores.prioridad === '' ? null : valores.prioridad,
    horaInicio: valores.horaInicio.slice(0, 5),
    horaFin: valores.horaFin.slice(0, 5),
    zonaHoraria: zona,
    ahora,
    frecuencia: serie.repetir,
    ...(serie.repetir === 'SEMANAL' ? { diasSemana: serie.diasSemana, intervaloSemanas: regla.intervalo } : { diaMes: regla.diaMes }),
    ...(regla.hasta !== undefined ? { hasta: regla.hasta } : { repeticiones: regla.repeticiones }),
    ...(serie.conRecordatorio ? { recordatorio: { minutosAntes: aEntero(serie.minutosAntes) as number } } : {}),
  }
  return { ok: true, request, fechas: calculo.fechas }
}
