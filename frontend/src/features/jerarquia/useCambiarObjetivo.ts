import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError } from '@/api/client'
import type { Proyecto } from '@/types/proyecto'
import { CONFIG_PROYECTO } from './config'
import { requestProyectoDe } from './formulario'
import { mensajeProyectoDesvinculado, mensajeProyectoVinculado } from './mensajes'
import { invalidarJerarquia } from './useAccionesJerarquia'

export interface DestinoObjetivo {
  id: number
  nombre: string
}

interface Opciones {
  /** Aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
}

interface Variables {
  proyecto: Proyecto
  /** `null` = quitarlo de su objetivo. */
  destino: DestinoObjetivo | null
  /** Nombre del objetivo que tenía, para el aviso de «ya no pertenece a». */
  nombreAnterior?: string
  alExito?: () => void
}

/**
 * Cambiar el objetivo de un proyecto sin abrir la edición completa: un PUT con los seis campos y solo
 * `objetivoId` distinto (el PUT reemplaza todo). Lo comparten el detalle del objetivo (vincular y quitar) y el
 * del proyecto (el select de «Datos»), así hay una sola regla.
 */
export function useCambiarObjetivo({ alMensaje }: Opciones) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutacion = useMutation({
    mutationFn: ({ proyecto, destino }: Variables) =>
      CONFIG_PROYECTO.actualizar(proyecto.id, requestProyectoDe(proyecto, { objetivoId: destino?.id ?? null })),
    onSuccess: async (_, { proyecto, destino, nombreAnterior, alExito }) => {
      // Primero se cierra y se avisa: la invalidación refresca la lista de candidatos del diálogo.
      alExito?.()
      if (destino) alMensaje(mensajeProyectoVinculado(proyecto.nombre, destino.nombre))
      else alMensaje(mensajeProyectoDesvinculado(proyecto.nombre, nombreAnterior ?? `n.º ${proyecto.objetivoId}`))
      await invalidarJerarquia(queryClient)
    },
    onError: (e) => {
      setError(e.message)
      // 404: el proyecto o el objetivo ya no existe; se refresca para que salga de las listas.
      if (e instanceof ApiError && e.status === 404) void invalidarJerarquia(queryClient)
    },
  })

  return {
    cambiar: (variables: Variables) => {
      setError(null)
      mutacion.mutate(variables)
    },
    pendiente: mutacion.isPending,
    error,
    limpiarError: () => setError(null),
  }
}
