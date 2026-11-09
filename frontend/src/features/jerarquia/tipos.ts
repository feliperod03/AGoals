import type { Estado, Prioridad } from '@/types/tarea'

/**
 * Lo que tienen en común proyectos y objetivos (casi idénticos en el backend). `Proyecto` suma `objetivoId`;
 * ambos cumplen este tipo estructuralmente.
 */
export interface ItemJerarquico {
  id: number
  nombre: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad | null
  padreId: number | null
  fechaCreacion: string
}

export const ESTADOS: readonly Estado[] = ['PENDIENTE', 'EN_PROGRESO', 'EN_PAUSA', 'HECHO', 'CANCELADO']

/** En masculino: proyectos y objetivos lo son (las tareas dicen «Hecha»). */
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  EN_PAUSA: 'En pausa',
  HECHO: 'Hecho',
  CANCELADO: 'Cancelado',
}

/** Abierto = PENDIENTE, EN_PROGRESO o EN_PAUSA. */
export function esAbierto(estado: Estado): boolean {
  return estado === 'PENDIENTE' || estado === 'EN_PROGRESO' || estado === 'EN_PAUSA'
}
