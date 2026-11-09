import { useQuery } from '@tanstack/react-query'

import { getTareas } from '@/api/tareas'

/** Única definición de la clave: la usan el Cofre y el diálogo de borrado. */
export const CLAVE_TODAS_LAS_TAREAS = ['tareas', 'todas'] as const

/** Todas las tareas (la clave empieza por `['tareas']`, así la cubre cualquier invalidación de tareas). */
export function useTodasLasTareas() {
  return useQuery({ queryKey: CLAVE_TODAS_LAS_TAREAS, queryFn: getTareas })
}
