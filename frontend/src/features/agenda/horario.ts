import { minutosDeHora, recortarEventoAlDia } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Estado, Prioridad, Tarea } from '@/types/tarea'

// Lógica pura de la planificación por horas: qué rango se dibuja y dónde va cada bloque.

export const HORA_INICIO_DEFECTO = 8
export const HORA_FIN_DEFECTO = 21
export const PX_POR_HORA = 56
/** Duración que se le da a una tarea con hora de inicio pero sin hora de fin. */
export const DURACION_POR_DEFECTO_MIN = 30
/** Un bloque nunca se dibuja ni se considera más corto que esto (así los cortos siguen siendo legibles). */
export const DURACION_MINIMA_VISUAL_MIN = 30

export interface Rango {
  inicioHora: number
  finHora: number
}

export interface Bloque {
  clave: string
  tipo: 'tarea' | 'evento'
  titulo: string
  inicioMin: number
  finMin: number
  estado?: Estado
  prioridad: Prioridad | null
  /** La tarea original (solo en bloques de tipo tarea), para poder editarla desde la planificación. */
  tarea?: Tarea
}

/** Lo que `distribuirSolapes` le agrega a cada bloque: su columna dentro del grupo de solapes y cuántas hay. */
export interface Colocacion {
  columna: number
  totalColumnas: number
}

export type BloqueColocado = Bloque & Colocacion

/** 08-21 por defecto; se amplía a horas enteras si algún bloque cae fuera de ese tramo. */
export function calcularRango(bloques: { inicioMin: number; finMin: number }[]): Rango {
  let inicioHora = HORA_INICIO_DEFECTO
  let finHora = HORA_FIN_DEFECTO
  for (const { inicioMin, finMin } of bloques) {
    inicioHora = Math.min(inicioHora, Math.floor(inicioMin / 60))
    finHora = Math.max(finHora, Math.ceil(finMin / 60))
  }
  return { inicioHora, finHora }
}

/** Posición y altura en píxeles de un bloque dentro de la línea de tiempo. */
export function posicionBloque(
  inicioMin: number,
  finMin: number,
  rango: Rango,
  pxPorHora: number = PX_POR_HORA,
): { top: number; height: number } {
  const porMinuto = pxPorHora / 60
  return {
    top: (inicioMin - rango.inicioHora * 60) * porMinuto,
    height: Math.max(finMin - inicioMin, DURACION_MINIMA_VISUAL_MIN) * porMinuto,
  }
}

/**
 * Coloca los bloques solapados lado a lado. Los que se tocan (aunque sea en cadena: A con B y
 * B con C) forman un grupo que reparte el ancho en las mismas columnas; cada bloque ocupa la
 * primera columna libre. Los bordes exactos no cuentan como choque. Para decidir el choque
 * un bloque dura al menos `DURACION_MINIMA_VISUAL_MIN`, porque así se dibuja. Genérica: conserva los demás
 * campos de cada bloque (el calendario semanal coloca sus propios elementos, con el evento o la tarea dentro).
 */
export function distribuirSolapes<T extends { inicioMin: number; finMin: number }>(bloques: T[]): (T & Colocacion)[] {
  const fin = (b: T) => Math.max(b.finMin, b.inicioMin + DURACION_MINIMA_VISUAL_MIN)
  const ordenados = [...bloques].sort((a, b) => a.inicioMin - b.inicioMin || fin(b) - fin(a))

  const resultado: (T & Colocacion)[] = []
  let grupo: (T & Colocacion)[] = []
  let finColumnas: number[] = []
  let finGrupo = -Infinity

  const cerrarGrupo = () => {
    for (const b of grupo) b.totalColumnas = finColumnas.length
    resultado.push(...grupo)
    grupo = []
    finColumnas = []
  }

  for (const bloque of ordenados) {
    if (bloque.inicioMin >= finGrupo) cerrarGrupo()
    let columna = finColumnas.findIndex((f) => f <= bloque.inicioMin)
    if (columna === -1) columna = finColumnas.length
    finColumnas[columna] = fin(bloque)
    finGrupo = Math.max(finGrupo, fin(bloque))
    grupo.push({ ...bloque, columna, totalColumnas: 1 })
  }
  cerrarGrupo()
  return resultado
}

/** Fin de una tarea con hora: el suyo, o inicio + duración por defecto si falta o no es posterior al inicio. */
export function finDeTarea(horaInicio: string, horaFin: string | null): number {
  const inicio = minutosDeHora(horaInicio)
  const fin = horaFin ? minutosDeHora(horaFin) : inicio
  return Math.min(fin > inicio ? fin : inicio + DURACION_POR_DEFECTO_MIN, 1440)
}

/** Tareas con hora y eventos del día `fecha` como bloques en minutos (eventos recortados al día). */
export function armarBloques(tareasConHora: Tarea[], eventos: Evento[], fecha: string): Bloque[] {
  const bloques: Bloque[] = []
  for (const t of tareasConHora) {
    if (!t.horaInicio) continue
    bloques.push({
      clave: `tarea-${t.id}`,
      tipo: 'tarea',
      titulo: t.titulo,
      inicioMin: minutosDeHora(t.horaInicio),
      finMin: finDeTarea(t.horaInicio, t.horaFin),
      estado: t.estado,
      prioridad: t.prioridad,
      tarea: t,
    })
  }
  for (const e of eventos) {
    const recorte = recortarEventoAlDia(e, fecha)
    if (!recorte) continue
    bloques.push({ clave: `evento-${e.id}`, tipo: 'evento', titulo: e.titulo, ...recorte, prioridad: e.prioridad })
  }
  return bloques
}
