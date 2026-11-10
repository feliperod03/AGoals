import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarRecordatorio, borrarRecordatorio, crearRecordatorio } from '@/api/recordatorios'
import { mensajeRecordatorioCreado, mensajeRecordatorioGuardado, mensajeRecordatorioQuitado } from '@/lib/fechas'
import type { RecordatorioRequest } from '@/types/recordatorio'

interface Opciones {
  /** Aviso flotante de la página desde donde se abrió. */
  alMensaje: (mensaje: string) => void
}

type Variables = { alExito?: () => void } & (
  | { accion: 'crear'; req: RecordatorioRequest }
  | { accion: 'actualizar'; id: number; req: RecordatorioRequest }
  | { accion: 'borrar'; id: number }
)

function llamar(v: Variables): Promise<unknown> {
  switch (v.accion) {
    case 'crear':
      return crearRecordatorio(v.req)
    case 'actualizar':
      return actualizarRecordatorio(v.id, v.req)
    case 'borrar':
      return borrarRecordatorio(v.id)
  }
}

function mensajeDe(v: Variables): string {
  if (v.accion === 'borrar') return mensajeRecordatorioQuitado()
  return v.accion === 'crear' ? mensajeRecordatorioCreado(v.req.fechaHora) : mensajeRecordatorioGuardado(v.req.fechaHora)
}

/**
 * Crear, actualizar o borrar un recordatorio. Una sola mutación a la vez: el guard es un `useRef` (no `isPending`,
 * que se actualiza en el siguiente render y dejaría pasar un doble clic) y se libera en `onSettled`, o sea cuando
 * ya terminó también el refresco. Toda mutación invalida `['recordatorios']` (consulta por tarea, banner de vencidos
 * y Próximos de Hoy). Un 404 (ya no existe) o un 409 (la tarea ya tenía uno) refrescan, y el mensaje del servidor
 * queda en `error`. `resultado` es el texto del último éxito, para la región `status` del diálogo.
 */
export function useAccionesRecordatorio({ alMensaje }: Opciones) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const enCurso = useRef(false)
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['recordatorios'] })

  const mutacion = useMutation({
    mutationFn: llamar,
    onSuccess: async (_, v) => {
      const mensaje = mensajeDe(v)
      setResultado(mensaje)
      alMensaje(mensaje)
      v.alExito?.()
      await refrescar()
    },
    onError: async (e) => {
      setError(e.message)
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) await refrescar()
    },
    onSettled: () => {
      enCurso.current = false
    },
  })

  const lanzar = (variables: Variables) => {
    if (enCurso.current) return
    enCurso.current = true
    setError(null)
    setResultado(null)
    mutacion.mutate(variables)
  }

  return {
    crear: (req: RecordatorioRequest, alExito?: () => void) => lanzar({ accion: 'crear', req, alExito }),
    actualizar: (id: number, req: RecordatorioRequest, alExito?: () => void) => lanzar({ accion: 'actualizar', id, req, alExito }),
    borrar: (id: number, alExito?: () => void) => lanzar({ accion: 'borrar', id, alExito }),
    pendiente: mutacion.isPending,
    error,
    resultado,
  }
}

export type AccionesRecordatorio = ReturnType<typeof useAccionesRecordatorio>
