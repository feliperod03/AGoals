import type { Estado } from '@/types/tarea'
import { unir } from './borrado'
import { cumpleEstado, type FiltroEstado } from './filtros'
import { ETIQUETA_ESTADO } from './tipos'

// Avisos de confirmación de proyectos y objetivos (los de fechas van en lib/fechas.ts).

/** `etiqueta` = «Proyecto» / «Objetivo». */
export const mensajeCreado = (etiqueta: string, nombre: string) => `${etiqueta} «${nombre}» creado`

export const mensajeGuardado = (nombre: string) => `«${nombre}» guardado`

/** `tambien`: lo demás que se borró con él («2 proyectos», «5 tareas»), si hubo. */
export const mensajeBorrado = (nombre: string, tambien: string[] = []) =>
  tambien.length === 0 ? `«${nombre}» borrado` : `«${nombre}» borrado; también ${unir(tambien)}`

export const mensajeProyectoVinculado = (proyecto: string, objetivo: string) => `«${proyecto}» ahora es parte de «${objetivo}»`

export const mensajeProyectoDesvinculado = (proyecto: string, objetivo: string) => `«${proyecto}» ya no pertenece a «${objetivo}»`

/**
 * Confirmación del cambio rápido de estado. Si el nuevo estado queda fuera del filtro de la lista, avisa que
 * la fila ya no se ve (si no, parece que el elemento desapareció).
 */
export function mensajeEstadoCambiado(nombre: string, estado: Estado, filtro: FiltroEstado): string {
  const base = `«${nombre}» pasó a ${ETIQUETA_ESTADO[estado]}`
  return cumpleEstado(estado, filtro) ? base : `${base}; ya no se ve con el filtro actual`
}
