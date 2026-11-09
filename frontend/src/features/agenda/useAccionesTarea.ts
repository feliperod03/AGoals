import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { borrarRecordatorio, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, borrarTarea, marcarHecha, posponerTarea, reabrirTarea } from '@/api/tareas'
import { mensajePospuesta, mensajeSinFecha } from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'
import { requestConEstado, requestSinFecha } from './formularioTarea'

export type TipoAccion = 'hecha' | 'reabrir' | 'posponer' | 'sinFecha' | 'cancelar' | 'reactivar'

export interface Acciones {
  /**
   * Ejecuta la acción y, si sale bien, avisa y cierra el diálogo de edición de esa tarea.
   * `fecha` (YYYY-MM-DD) solo la usa `'posponer'`, que siempre la manda explícita.
   */
  ejecutar: (tipo: TipoAccion, tarea: Tarea, fecha?: string) => void
  /** Abre el selector de posponer (Mañana / Elegir fecha / Dejar sin fecha) para esa tarea. */
  pedirPosponer: (tarea: Tarea) => void
  /** Selector abierto; se cierra solo cuando la acción sale bien y sigue abierto si falla. */
  posponer: { tarea: Tarea; cancelar: () => void } | null
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
  sinFecha: mensajeSinFecha(),
} as const

function ejecutarAccion(tipo: TipoAccion, tarea: Tarea, fecha?: string): Promise<Tarea> {
  switch (tipo) {
    case 'hecha':
      return marcarHecha(tarea.id)
    case 'reabrir':
      return reabrirTarea(tarea.id)
    case 'posponer':
      if (!fecha) return Promise.reject(new Error('Falta la fecha para posponer.'))
      return posponerTarea(tarea.id, fecha)
    case 'sinFecha':
      return actualizarTarea(tarea.id, requestSinFecha(tarea))
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
  const [aPosponer, setAPosponer] = useState<Tarea | null>(null)
  const [aBorrar, setABorrar] = useState<Tarea | null>(null)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null)
  const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null)

  const invalidarTareas = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['agenda'] }), queryClient.invalidateQueries({ queryKey: ['tareas'] })])

  const accion = useMutation({
    mutationFn: ({ tipo, tarea, fecha }: { tipo: TipoAccion; tarea: Tarea; fecha?: string }) => ejecutarAccion(tipo, tarea, fecha),
    onSuccess: async (actualizada, { tipo, tarea }) => {
      await invalidarTareas()
      if (tipo === 'posponer' || tipo === 'sinFecha') setAPosponer(null)
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
    ejecutar: (tipo, tarea, fecha) => {
      setError(null)
      accion.mutate({ tipo, tarea, fecha })
    },
    pedirPosponer: (tarea) => {
      setError(null)
      setAPosponer(tarea)
    },
    posponer: aPosponer ? { tarea: aPosponer, cancelar: () => setAPosponer(null) } : null,
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
