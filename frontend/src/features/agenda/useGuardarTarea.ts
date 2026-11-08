import { useMutation, useQueryClient } from '@tanstack/react-query'

import { actualizarTarea, crearTarea } from '@/api/tareas'
import type { TareaRequest } from '@/types/tarea'

/**
 * Crea (sin `id`) o actualiza (con `id`) una tarea. Al terminar invalida las consultas de tareas:
 * `['agenda']` (Hoy, una por día) y `['tareas']` (tarea suelta por id).
 */
export function useGuardarTarea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id?: number; request: TareaRequest }) =>
      id === undefined ? crearTarea(request) : actualizarTarea(id, request),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agenda'] }),
        queryClient.invalidateQueries({ queryKey: ['tareas'] }),
      ])
    },
  })
}
