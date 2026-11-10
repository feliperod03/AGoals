import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { asignarTarea as asignarAObjetivo, quitarTarea as quitarDeObjetivo } from '@/api/objetivos'
import { asignarTarea as asignarAProyecto, quitarTarea as quitarDeProyecto } from '@/api/proyectos'
import { mensajeTareaDesvinculada, mensajeTareaVinculada } from '@/lib/fechas'
import type { Tarea } from '@/types/tarea'
import type { TipoVinculo } from './candidatosVinculo'

/** El proyecto u objetivo con el que se liga (o del que se suelta) la tarea. */
export interface DestinoVinculo {
  id: number
  nombre: string
}

interface Opciones {
  /** Aviso flotante de la página desde donde se abrió. */
  alMensaje: (mensaje: string) => void
}

interface Variables {
  accion: 'asignar' | 'quitar'
  tipo: TipoVinculo
  tarea: Tarea
  destino: DestinoVinculo
  /** Se llama tras un éxito, antes de refrescar (p. ej. para cerrar el buscador). Con un error NO se llama. */
  alExito?: () => void
}

const CLAVE_LISTA: Record<TipoVinculo, string> = { proyecto: 'proyectos', objetivo: 'objetivos' }

function llamar({ accion, tipo, tarea, destino }: Variables): Promise<unknown> {
  if (tipo === 'proyecto') return accion === 'asignar' ? asignarAProyecto(destino.id, tarea.id) : quitarDeProyecto(destino.id, tarea.id)
  return accion === 'asignar' ? asignarAObjetivo(destino.id, tarea.id) : quitarDeObjetivo(destino.id, tarea.id)
}

/**
 * Ligar una tarea a un proyecto u objetivo (PUT) o quitar el vínculo (DELETE). Una sola mutación a la vez:
 * mientras haya una en curso (también durante el refresco posterior) `pendiente` es true y se ignora cualquier
 * otra llamada. El guard es un `useRef` y no `isPending`, porque este último se actualiza en el siguiente
 * render y dos clics seguidos lo verían todavía en false.
 *
 * Éxito: aviso e invalidación de `['agenda']` y `['tareas']` (el detalle de proyectos/objetivos sale de
 * `['tareas','todas']`). Error 400/404: el dato estaba viejo, se refrescan las tareas; en 404 también la lista
 * del tipo, para que el proyecto/objetivo borrado salga de los candidatos.
 */
export function useVincularTarea({ alMensaje }: Opciones) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const enCurso = useRef(false)

  const invalidarTareas = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['agenda'] }), queryClient.invalidateQueries({ queryKey: ['tareas'] })])

  const mutacion = useMutation({
    mutationFn: llamar,
    onSuccess: async (_, v) => {
      // Primero se avisa y se cierra: la invalidación refresca las listas que usa el diálogo.
      v.alExito?.()
      alMensaje(
        v.accion === 'asignar'
          ? mensajeTareaVinculada(v.tarea.titulo, v.tipo, v.destino.nombre)
          : mensajeTareaDesvinculada(v.tarea.titulo, v.tipo, v.destino.nombre),
      )
      await invalidarTareas()
    },
    onError: async (e, v) => {
      setError(e.message)
      if (e instanceof ApiError && (e.status === 400 || e.status === 404)) {
        await Promise.all([invalidarTareas(), e.status === 404 ? queryClient.invalidateQueries({ queryKey: [CLAVE_LISTA[v.tipo]] }) : undefined])
      }
    },
    onSettled: () => {
      enCurso.current = false
    },
  })

  const lanzar = (variables: Variables) => {
    if (enCurso.current) return
    enCurso.current = true
    setError(null)
    mutacion.mutate(variables)
  }

  return {
    asignar: (v: Omit<Variables, 'accion'>) => lanzar({ ...v, accion: 'asignar' }),
    quitar: (v: Omit<Variables, 'accion'>) => lanzar({ ...v, accion: 'quitar' }),
    pendiente: mutacion.isPending,
    error,
    limpiarError: () => setError(null),
  }
}
