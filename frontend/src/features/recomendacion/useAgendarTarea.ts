import { useMutation, useQueryClient } from '@tanstack/react-query'

import { agendarTarea } from '@/api/tareas'
import { mensajeAgendada } from '@/lib/fechas'
import type { TareaRecomendada } from '@/types/tarea'

/** Cuenta los descendientes de todos los niveles. */
export function contarSubtareas(raiz: TareaRecomendada): number {
  return raiz.subtareas.reduce((total, hija) => total + 1 + contarSubtareas(hija), 0)
}

/**
 * Agenda una tarea raíz para hoy, con o sin sus subtareas. Al terminar invalida `['agenda']` y `['tareas']`
 * (esta última cubre la lista de recomendación). Si falla también refresca la lista: un 409 o un 404
 * suelen significar que la tarea cambió desde que se cargó.
 */
export function useAgendarTarea({ hoy, alAgendar }: { hoy: string; alAgendar: (mensaje: string) => void }) {
  const queryClient = useQueryClient()
  const invalidar = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['agenda'] }), queryClient.invalidateQueries({ queryKey: ['tareas'] })])

  return useMutation({
    mutationFn: ({ raiz, incluirSubtareas }: { raiz: TareaRecomendada; incluirSubtareas: boolean }) =>
      agendarTarea(raiz.tarea.id, { fecha: hoy, hoy, incluirSubtareas }),
    onSuccess: async (modificadas, { raiz }) => {
      await invalidar()
      // La madre viene primera: el resto son subtareas que también se agendaron.
      alAgendar(mensajeAgendada(raiz.tarea.titulo, modificadas.length - 1))
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['tareas'] }),
  })
}
