import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { borrarRecordatorio, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, borrarTarea, marcarHecha, posponerTarea, reabrirTarea } from '@/api/tareas'
import { mensajePospuesta } from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'
import { requestConEstado } from './formularioTarea'

export type TipoAccion = 'hecha' | 'reabrir' | 'posponer' | 'cancelar' | 'reactivar'

export interface Acciones {
  /** Ejecuta la acción y, si sale bien, avisa y cierra el diálogo de edición de esa tarea. */
  ejecutar: (tipo: TipoAccion, tarea: Tarea) => void
  /** Abre la confirmación de borrado (el DELETE solo se manda al confirmar). */
  pedirBorrado: (tarea: Tarea) => void
  /** Hay una acción en curso: los botones se deshabilitan. */
  pendiente: boolean
  /** Último error legible de una acción (400/404/409); se limpia al lanzar otra. */
  error: string | null
  confirmarBorrado: { tarea: Tarea; error: string | null; pendiente: boolean; confirmar: () => void; cancelar: () => void } | null
  preguntaRecordatorio: {
    recordatorio: Recordatorio
    error: string | null
    pendiente: boolean
    borrar: () => void
    conservar: () => void
  } | null
}

interface Opciones {
  /** Confirmación para la región aria-live de la página. */
  alMensaje: (mensaje: string) => void
  /** Una acción sobre esta tarea terminó: si su diálogo de edición está abierto, hay que cerrarlo. */
  alTerminar: (tareaId: number) => void
}

const MENSAJES = {
  hecha: 'Marcada como hecha',
  reabrir: 'Reabierta',
  cancelar: 'Tarea cancelada',
  reactivar: 'Reactivada',
} as const

function ejecutarAccion(tipo: TipoAccion, tarea: Tarea): Promise<Tarea> {
  switch (tipo) {
    case 'hecha':
      return marcarHecha(tarea.id)
    case 'reabrir':
      return reabrirTarea(tarea.id)
    case 'posponer':
      return posponerTarea(tarea.id)
    case 'cancelar':
      return actualizarTarea(tarea.id, requestConEstado(tarea, 'CANCELADO'))
    case 'reactivar':
      return actualizarTarea(tarea.id, requestConEstado(tarea, 'PENDIENTE'))
  }
}

/**
 * Acciones rápidas sobre una tarea. Una sola mutación a la vez (`pendiente` deshabilita todos los botones).
 * Al marcar hecha o cancelar consulta si la tarea tiene un recordatorio sin enviar y, si lo hay, deja
 * `preguntaRecordatorio` para que la página pregunte si se borra o se conserva.
 */
export function useAccionesTarea({ alMensaje, alTerminar }: Opciones): Acciones {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<Tarea | null>(null)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null)
  const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null)

  const invalidarTareas = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['agenda'] }), queryClient.invalidateQueries({ queryKey: ['tareas'] })])

  const accion = useMutation({
    mutationFn: ({ tipo, tarea }: { tipo: TipoAccion; tarea: Tarea }) => ejecutarAccion(tipo, tarea),
    onSuccess: async (actualizada, { tipo, tarea }) => {
      await invalidarTareas()
      // Posponer: el mensaje usa la fecha que calculó el backend.
      alMensaje(tipo === 'posponer' ? mensajePospuesta(actualizada.fecha ?? '') : MENSAJES[tipo])
      alTerminar(tarea.id)
      if (tipo === 'hecha' || tipo === 'cancelar') {
        try {
          const lista = await queryClient.fetchQuery({
            queryKey: ['recordatorios', { tareaId: tarea.id }],
            queryFn: () => getRecordatoriosDeTarea(tarea.id),
            staleTime: 0,
          })
          const pendiente = lista.find((r) => !r.enviado)
          if (pendiente) {
            setErrorRecordatorio(null)
            setRecordatorio(pendiente)
          }
        } catch {
          // Sin la consulta no se puede preguntar: la acción ya salió bien, se omite la pregunta.
        }
      }
    },
    onError: (e) => setError(e.message),
  })

  const borrado = useMutation({
    mutationFn: (tarea: Tarea) => borrarTarea(tarea.id),
    onSuccess: async (_, tarea) => {
      await Promise.all([invalidarTareas(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
      setABorrar(null)
      alMensaje('Tarea borrada')
      alTerminar(tarea.id)
    },
    onError: (e) => setErrorBorrado(e.message),
  })

  const borradoRecordatorio = useMutation({
    mutationFn: (id: number) => borrarRecordatorio(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recordatorios'] })
      setRecordatorio(null)
      alMensaje('Recordatorio borrado')
    },
    onError: (e) => setErrorRecordatorio(e.message),
  })

  return {
    ejecutar: (tipo, tarea) => {
      setError(null)
      accion.mutate({ tipo, tarea })
    },
    pedirBorrado: (tarea) => {
      setErrorBorrado(null)
      setABorrar(tarea)
    },
    pendiente: accion.isPending || borrado.isPending,
    error,
    confirmarBorrado: aBorrar
      ? {
          tarea: aBorrar,
          error: errorBorrado,
          pendiente: borrado.isPending,
          confirmar: () => {
            setErrorBorrado(null)
            borrado.mutate(aBorrar)
          },
          cancelar: () => setABorrar(null),
        }
      : null,
    preguntaRecordatorio: recordatorio
      ? {
          recordatorio,
          error: errorRecordatorio,
          pendiente: borradoRecordatorio.isPending,
          borrar: () => {
            setErrorRecordatorio(null)
            borradoRecordatorio.mutate(recordatorio.id)
          },
          conservar: () => setRecordatorio(null),
        }
      : null,
  }
}
