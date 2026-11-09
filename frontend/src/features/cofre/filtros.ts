import { compararFechaHora, esAtrasada, formatearDiaMes } from '@/lib/fechas'
import { normalizarTexto } from '@/lib/texto'
import type { Estado, Prioridad, Tarea } from '@/types/tarea'

// Lógica pura del Cofre (sin React): filtros, accesos rápidos y orden.

export type FiltroFecha = 'todas' | 'con' | 'sin' | 'atrasadas' | 'futuras' | 'rango'
/** `abiertas` = todo menos HECHO y CANCELADO; `todas` = sin restricción. */
export type FiltroEstado = 'abiertas' | 'todas' | Estado
export type FiltroPrioridad = 'cualquiera' | 'ninguna' | Prioridad
/** Solo el vínculo directo de la tarea. Con `id` null, `proyecto`/`objetivo` = "cualquiera de ese tipo". */
export type FiltroVinculo =
  | { tipo: 'cualquiera' }
  | { tipo: 'suelta' }
  | { tipo: 'proyecto' | 'objetivo'; id: number | null }

export interface FiltrosCofre {
  fecha: FiltroFecha
  /** Solo con `fecha: 'rango'` (YYYY-MM-DD, inclusivos; '' = sin límite). */
  desde: string
  hasta: string
  estado: FiltroEstado
  prioridad: FiltroPrioridad
  vinculo: FiltroVinculo
  busqueda: string
}

/** Vista por defecto: lo que está en el cofre de verdad, es decir, tareas abiertas sin fecha. */
export const FILTROS_POR_DEFECTO: FiltrosCofre = {
  fecha: 'sin',
  desde: '',
  hasta: '',
  estado: 'abiertas',
  prioridad: 'cualquiera',
  vinculo: { tipo: 'cualquiera' },
  busqueda: '',
}

export function hayFiltrosActivos(filtros: FiltrosCofre): boolean {
  return JSON.stringify(filtros) !== JSON.stringify(FILTROS_POR_DEFECTO)
}

const cerrada = (estado: Estado) => estado === 'HECHO' || estado === 'CANCELADO'

/** El rango es incoherente si el inicio es posterior al fin (no coincide nada). */
export function rangoInvertido(filtros: FiltrosCofre): boolean {
  return filtros.fecha === 'rango' && filtros.desde !== '' && filtros.hasta !== '' && filtros.desde > filtros.hasta
}

/** Todos los criterios se combinan con AND. Conserva el orden de entrada. */
export function filtrar(tareas: Tarea[], f: FiltrosCofre, hoy: string): Tarea[] {
  const texto = normalizarTexto(f.busqueda.trim())
  return tareas.filter((t) => {
    if (!cumpleFecha(t, f, hoy)) return false
    if (f.estado === 'abiertas' ? cerrada(t.estado) : f.estado !== 'todas' && t.estado !== f.estado) return false
    if (f.prioridad === 'ninguna' ? t.prioridad !== null : f.prioridad !== 'cualquiera' && t.prioridad !== f.prioridad) return false
    if (!cumpleVinculo(t, f.vinculo)) return false
    return texto === '' || normalizarTexto(t.titulo).includes(texto)
  })
}

function cumpleFecha(t: Tarea, f: FiltrosCofre, hoy: string): boolean {
  switch (f.fecha) {
    case 'todas':
      return true
    case 'con':
      return t.fecha !== null
    case 'sin':
      return t.fecha === null
    case 'atrasadas':
      return esAtrasada(t.fecha, hoy)
    case 'futuras':
      return t.fecha !== null && t.fecha > hoy
    case 'rango':
      // Las tareas sin fecha quedan fuera de cualquier rango.
      return t.fecha !== null && (f.desde === '' || t.fecha >= f.desde) && (f.hasta === '' || t.fecha <= f.hasta)
  }
}

function cumpleVinculo(t: Tarea, v: FiltroVinculo): boolean {
  switch (v.tipo) {
    case 'cualquiera':
      return true
    case 'suelta':
      return t.proyectoId === null && t.objetivoId === null
    case 'proyecto':
      return v.id === null ? t.proyectoId !== null : t.proyectoId === v.id
    case 'objetivo':
      return v.id === null ? t.objetivoId !== null : t.objetivoId === v.id
  }
}

// --- Accesos rápidos ("filtros anclados") ---

export type PresetId =
  | 'sinFecha'
  | 'conFecha'
  | 'atrasadas'
  | 'futuras'
  | 'prioridadAlta'
  | 'prioridadMedia'
  | 'sinPrioridad'
  | 'pendientes'
  | 'enProgreso'
  | 'sueltas'

/**
 * Un acceso rápido toca una sola dimensión del filtro. `parche` es lo que aplica al activarse y `neutro`
 * a lo que vuelve esa dimensión al desactivarse. El resto de los filtros no se toca (se suman con AND).
 */
export interface Preset {
  id: PresetId
  etiqueta: string
  parche: Partial<FiltrosCofre>
  neutro: Partial<FiltrosCofre>
}

const FECHA_NEUTRA = { fecha: 'todas', desde: '', hasta: '' } as const

export const PRESETS: readonly Preset[] = [
  { id: 'sinFecha', etiqueta: 'Sin fecha', parche: { fecha: 'sin', desde: '', hasta: '' }, neutro: FECHA_NEUTRA },
  { id: 'conFecha', etiqueta: 'Con fecha', parche: { fecha: 'con', desde: '', hasta: '' }, neutro: FECHA_NEUTRA },
  { id: 'atrasadas', etiqueta: 'Atrasadas', parche: { fecha: 'atrasadas', desde: '', hasta: '' }, neutro: FECHA_NEUTRA },
  { id: 'futuras', etiqueta: 'Futuras', parche: { fecha: 'futuras', desde: '', hasta: '' }, neutro: FECHA_NEUTRA },
  { id: 'prioridadAlta', etiqueta: 'Prioridad alta', parche: { prioridad: 'ALTA' }, neutro: { prioridad: 'cualquiera' } },
  { id: 'prioridadMedia', etiqueta: 'Prioridad media', parche: { prioridad: 'MEDIA' }, neutro: { prioridad: 'cualquiera' } },
  { id: 'sinPrioridad', etiqueta: 'Sin prioridad', parche: { prioridad: 'ninguna' }, neutro: { prioridad: 'cualquiera' } },
  { id: 'pendientes', etiqueta: 'Pendientes', parche: { estado: 'PENDIENTE' }, neutro: { estado: 'abiertas' } },
  { id: 'enProgreso', etiqueta: 'En progreso', parche: { estado: 'EN_PROGRESO' }, neutro: { estado: 'abiertas' } },
  { id: 'sueltas', etiqueta: 'Sueltas', parche: { vinculo: { tipo: 'suelta' } }, neutro: { vinculo: { tipo: 'cualquiera' } } },
]

export const MAX_ANCLADOS = 3

export const ANCLADOS_POR_DEFECTO: readonly PresetId[] = ['sinFecha', 'atrasadas', 'prioridadAlta']

export function presetPorId(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id)!
}

/** Activo cuando todas las claves del parche coinciden con los filtros actuales. */
export function presetActivo(filtros: FiltrosCofre, preset: Preset): boolean {
  return (Object.keys(preset.parche) as (keyof FiltrosCofre)[]).every(
    (clave) => JSON.stringify(filtros[clave]) === JSON.stringify(preset.parche[clave]),
  )
}

/** Pulsar un acceso rápido: lo activa, o si ya estaba activo devuelve esa dimensión a neutro. */
export function alternarPreset(filtros: FiltrosCofre, preset: Preset): FiltrosCofre {
  return { ...filtros, ...(presetActivo(filtros, preset) ? preset.neutro : preset.parche) }
}

// --- Filtros activos (chips) ---

/** Dimensiones que pueden generar un chip. La búsqueda no: su input está siempre a la vista. */
export type DimensionFiltro = 'fecha' | 'estado' | 'prioridad' | 'vinculo'

export interface FiltroActivo {
  dimension: DimensionFiltro
  texto: string
  /** Lo que se aplica al pulsar la «×»: esa dimensión vuelve a su valor neutro. */
  quitar: Partial<FiltrosCofre>
}

/** Nombres de proyectos y objetivos para rotular el chip del vínculo. */
export interface NombresVinculo {
  proyectos: ReadonlyMap<number, string>
  objetivos: ReadonlyMap<number, string>
}

const TEXTO_ESTADO: Record<Exclude<FiltroEstado, 'abiertas'>, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  EN_PAUSA: 'En pausa',
  HECHO: 'Hecha',
  CANCELADO: 'Cancelada',
  todas: 'Todas',
}

const TEXTO_PRIORIDAD: Record<Prioridad, string> = { ALTA: 'Prioridad alta', MEDIA: 'Prioridad media', BAJA: 'Prioridad baja' }

function textoFecha(f: FiltrosCofre): string {
  switch (f.fecha) {
    case 'con':
      return 'Con fecha'
    case 'sin':
      return 'Sin fecha'
    case 'atrasadas':
      return 'Atrasadas'
    case 'futuras':
      return 'Futuras'
    case 'rango': {
      if (f.desde && f.hasta) return `Desde ${formatearDiaMes(f.desde)} hasta ${formatearDiaMes(f.hasta)}`
      if (f.desde) return `Desde ${formatearDiaMes(f.desde)}`
      if (f.hasta) return `Hasta ${formatearDiaMes(f.hasta)}`
      return 'Rango de fechas'
    }
    case 'todas':
      return ''
  }
}

function textoVinculo(v: FiltroVinculo, nombres: NombresVinculo): string {
  switch (v.tipo) {
    case 'cualquiera':
      return ''
    case 'suelta':
      return 'Suelta'
    case 'proyecto':
      return v.id === null ? 'De un proyecto' : `Proyecto: «${nombres.proyectos.get(v.id) ?? `#${v.id}`}»`
    case 'objetivo':
      return v.id === null ? 'De un objetivo' : `Objetivo: «${nombres.objetivos.get(v.id) ?? `#${v.id}`}»`
  }
}

/**
 * Todas las dimensiones fuera de su valor neutro (fecha ≠ todas, estado ≠ abiertas, prioridad ≠ cualquiera,
 * vínculo ≠ cualquiera), estén o no representadas por un acceso rápido. "Abiertas" es la línea base: no cuenta.
 * Ojo: la vista por defecto tiene fecha «sin», que sí es un filtro activo.
 */
export function filtrosActivos(f: FiltrosCofre, nombres: NombresVinculo): FiltroActivo[] {
  const activos: FiltroActivo[] = []
  if (f.fecha !== 'todas') activos.push({ dimension: 'fecha', texto: textoFecha(f), quitar: { fecha: 'todas', desde: '', hasta: '' } })
  if (f.estado !== 'abiertas') activos.push({ dimension: 'estado', texto: `Estado: ${TEXTO_ESTADO[f.estado]}`, quitar: { estado: 'abiertas' } })
  if (f.prioridad !== 'cualquiera') {
    activos.push({ dimension: 'prioridad', texto: f.prioridad === 'ninguna' ? 'Sin prioridad' : TEXTO_PRIORIDAD[f.prioridad], quitar: { prioridad: 'cualquiera' } })
  }
  if (f.vinculo.tipo !== 'cualquiera') activos.push({ dimension: 'vinculo', texto: textoVinculo(f.vinculo, nombres), quitar: { vinculo: { tipo: 'cualquiera' } } })
  return activos
}

/** Dimensión que toca un acceso rápido (todos tocan una sola). */
function dimensionDe(preset: Preset): DimensionFiltro {
  if ('fecha' in preset.parche) return 'fecha'
  if ('estado' in preset.parche) return 'estado'
  if ('prioridad' in preset.parche) return 'prioridad'
  return 'vinculo'
}

/** Los chips: filtros activos que no tiene ya a la vista un acceso rápido anclado y encendido. */
export function chipsDeFiltros(f: FiltrosCofre, anclados: readonly PresetId[], nombres: NombresVinculo): FiltroActivo[] {
  const cubiertas = new Set(
    anclados
      .map(presetPorId)
      .filter((p) => presetActivo(f, p))
      .map(dimensionDe),
  )
  return filtrosActivos(f, nombres).filter((a) => !cubiertas.has(a.dimension))
}

/**
 * Texto del estado vacío cuando hay filtros distintos de la vista por defecto. Nombra todos los filtros
 * activos (también los de accesos rápidos y la búsqueda). Si solo queda la línea base (abiertas) nunca
 * deja una lista vacía tras los dos puntos.
 */
export function textoSinResultados(f: FiltrosCofre, nombres: NombresVinculo): string {
  const nombrados = filtrosActivos(f, nombres).map((a) => a.texto)
  const busqueda = f.busqueda.trim()
  if (busqueda) nombrados.push(`Título contiene «${busqueda}»`)
  return nombrados.length === 0 ? 'No hay tareas abiertas.' : `No hay tareas con estos filtros: ${nombrados.join(', ')}.`
}

// --- Orden ---

export type OrdenCofre = 'fecha' | 'prioridad' | 'antiguedad'
export type SentidoCofre = 'asc' | 'desc'

/** Sentido con el que empieza cada orden: fecha más cercana, prioridad alta y más antiguas primero. */
export const SENTIDO_NATURAL: Record<OrdenCofre, SentidoCofre> = { fecha: 'asc', prioridad: 'desc', antiguedad: 'asc' }

const RANGO_PRIORIDAD: Record<Prioridad, number> = { BAJA: 1, MEDIA: 2, ALTA: 3 }

/**
 * Orden estable con desempate por id. Las tareas sin fecha (o sin prioridad) van siempre al final,
 * tanto en ascendente como en descendente.
 */
export function ordenar(tareas: Tarea[], orden: OrdenCofre, sentido: SentidoCofre): Tarea[] {
  const signo = sentido === 'asc' ? 1 : -1
  return [...tareas].sort((a, b) => {
    const faltaA = faltaDato(a, orden)
    const faltaB = faltaDato(b, orden)
    if (faltaA !== faltaB) return faltaA ? 1 : -1
    const cmp = faltaA ? 0 : comparar(a, b, orden)
    return cmp !== 0 ? cmp * signo : a.id - b.id
  })
}

function faltaDato(t: Tarea, orden: OrdenCofre): boolean {
  if (orden === 'fecha') return t.fecha === null
  if (orden === 'prioridad') return t.prioridad === null
  return false
}

function comparar(a: Tarea, b: Tarea, orden: OrdenCofre): number {
  if (orden === 'fecha') return a.fecha! < b.fecha! ? -1 : a.fecha! > b.fecha! ? 1 : 0
  if (orden === 'prioridad') return RANGO_PRIORIDAD[a.prioridad!] - RANGO_PRIORIDAD[b.prioridad!]
  return compararFechaHora(a.fechaCreacion, b.fechaCreacion)
}
