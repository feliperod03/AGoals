import type { CategoriaBorrado, Eleccion, Elecciones, ImpactoBorrado } from '@/types/impactoBorrado'

// Lo puro del diálogo de borrado: parámetros del DELETE, filas visibles y textos. Sin React ni red.

/** Una categoría sobre la que se elige al borrar un proyecto u objetivo. */
export interface DefCategoria {
  clave: CategoriaBorrado
  /** Título de la fila: «Subproyectos». */
  etiqueta: string
  singular: string
  plural: string
  /** Qué pasa con ellos si se elige «Mover» (conservar). */
  mover: string
  /** Qué arrastra además cuando `borrados > total`: «subtareas». Sin él no se aclara nada (las ideas no tienen jerarquía). */
  incluye?: string
}

export function plural(n: number, singular: string, plurales: string): string {
  return `${n} ${n === 1 ? singular : plurales}`
}

/** «a», «a y b», «a, b y c». */
export function unir(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Las filas del diálogo salen de la última respuesta: solo las categorías con elementos (`total > 0`). */
export function categoriasVisibles(impacto: ImpactoBorrado, categorias: readonly DefCategoria[]): DefCategoria[] {
  return categorias.filter((c) => (impacto[c.clave]?.total ?? 0) > 0)
}

export const eleccionDe = (elecciones: Elecciones, clave: CategoriaBorrado): Eleccion => elecciones[clave] ?? 'conservar'

/** Parámetros del DELETE: uno explícito por cada fila visible, nunca por filas ocultas. */
export function parametrosDe(elecciones: Elecciones, visibles: readonly DefCategoria[]): Elecciones {
  const parametros: Elecciones = {}
  for (const c of visibles) parametros[c.clave] = eleccionDe(elecciones, c.clave)
  return parametros
}

/** Elecciones completas y con orden fijo (una por categoría de la config): sirve de parte de la clave de la query. */
export function eleccionesNormalizadas(elecciones: Elecciones, categorias: readonly DefCategoria[]): Elecciones {
  return parametrosDe(elecciones, categorias)
}

/** «2 proyectos», «5 tareas»: lo que desaparece, por categoría con `borrados > 0`. */
export function partesBorradas(impacto: ImpactoBorrado, categorias: readonly DefCategoria[]): string[] {
  const partes: string[] = []
  for (const c of categorias) {
    const borrados = impacto[c.clave]?.borrados ?? 0
    if (borrados > 0) partes.push(plural(borrados, c.singular, c.plural))
  }
  return partes
}

/** Resumen en vivo: solo lo que se borra. */
export function resumenBorrado(nombre: string, impacto: ImpactoBorrado, categorias: readonly DefCategoria[]): string {
  const partes = partesBorradas(impacto, categorias)
  if (partes.length === 0) return `Solo se borrará «${nombre}».`
  return `Se borrarán ${unir([`«${nombre}»`, ...partes])}.`
}

/** Proyectos que se salvan por estar ligados a otro objetivo; solo tiene sentido con proyectos=borrar. */
export function avisoRescatados(impacto: ImpactoBorrado, elecciones: Elecciones): string | null {
  const rescatados = impacto.proyectos?.rescatados ?? 0
  if (rescatados <= 0 || elecciones.proyectos !== 'borrar') return null
  return rescatados === 1
    ? '1 proyecto se salva por estar ligado a otro objetivo.'
    : `${rescatados} proyectos se salvan por estar ligados a otro objetivo.`
}

/** Ayuda bajo el interruptor de una fila. */
export function textoFila(def: DefCategoria, impacto: ImpactoBorrado, eleccion: Eleccion): string {
  if (eleccion === 'conservar') return def.mover
  const conteo = impacto[def.clave]
  const borrados = conteo?.borrados ?? 0
  if (borrados === 0) return 'No se borra ninguno'
  const base = `${borrados === 1 ? 'Se borra' : 'Se borran'} ${plural(borrados, def.singular, def.plural)}`
  return def.incluye && borrados > (conteo?.total ?? 0) ? `${base} (incluye ${def.incluye})` : base
}
