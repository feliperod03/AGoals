import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { Estado } from '@/types/tarea'
import type { ConfigJerarquia } from './config'
import type { FiltroEstado } from './filtros'
import { mensajeBorrado, mensajeEstadoCambiado } from './mensajes'
import type { ItemJerarquico } from './tipos'

/**
 * Tras toda mutación de proyecto u objetivo se refrescan las DOS listas: son chicas y así no hay que razonar
 * caso por caso (el nombre de un objetivo se ve en los proyectos, y los proyectos de un objetivo en su detalle).
 * No se tocan las tareas: no cambian (borrar con tareas da 409).
 */
export function invalidarJerarquia(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['proyectos'] }),
    queryClient.invalidateQueries({ queryKey: ['objetivos'] }),
  ])
}

/** Crear / editar / borrar con la misma mutación que usa el diálogo: crea sin `id`, actualiza con `id`. */
export function useGuardarJerarquia<T extends ItemJerarquico, R>(config: ConfigJerarquia<T, R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, request }: { id?: number; request: R }) => (id === undefined ? config.crear(request) : config.actualizar(id, request)),
    onSuccess: () => invalidarJerarquia(queryClient),
  })
}

/** `{}` = diálogo para crear; `{ item }` = para editar. */
export interface EstadoItemDialog<T> {
  item?: T
}

export interface AccionesJerarquia<T extends ItemJerarquico> {
  dialogo: EstadoItemDialog<T> | null
  abrirCrear: () => void
  abrirEditar: (item: T) => void
  cerrarDialogo: () => void
  /** Cambio rápido de estado, sin propagar a padres ni hijos. */
  cambiarEstado: (item: T, estado: Estado) => void
  /** Abre la confirmación de borrado (el DELETE solo se manda al confirmar). */
  pedirBorrado: (item: T) => void
  /** Hay una acción en curso: los controles se deshabilitan. */
  pendiente: boolean
  /** Último error legible del cambio de estado; se limpia al lanzar otro. */
  error: string | null
  borrado: {
    item: T
    /** Mensaje del servidor tal cual (p. ej. el 409 por subproyectos, tareas o ideas). */
    error: string | null
    pendiente: boolean
    confirmar: () => void
    cancelar: () => void
  } | null
}

interface Opciones<T> {
  /** Confirmación para el aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
  /** Filtro de estado vigente (la lista); en el detalle no hay filtro: `'todos'`. */
  filtroEstado: FiltroEstado
  /**
   * Si se pasa, un borrado exitoso lo llama en lugar de `alMensaje` (el detalle navega a la lista llevando
   * el aviso, porque su propia página deja de existir).
   */
  alBorrado?: (item: T, mensaje: string) => void
}

/**
 * Acciones sobre proyectos u objetivos: diálogo de crear/editar, cambio rápido de estado y borrado con
 * confirmación. Una sola mutación a la vez (`pendiente` deshabilita los controles).
 */
export function useAccionesJerarquia<T extends ItemJerarquico, R>(
  config: ConfigJerarquia<T, R>,
  { alMensaje, filtroEstado, alBorrado }: Opciones<T>,
): AccionesJerarquia<T> {
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<EstadoItemDialog<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<T | null>(null)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)

  const estado = useMutation({
    mutationFn: ({ item, nuevo }: { item: T; nuevo: Estado }) => config.actualizar(item.id, config.requestConEstado(item, nuevo)),
    onSuccess: async (_, { item, nuevo }) => {
      alMensaje(mensajeEstadoCambiado(item.nombre, nuevo, filtroEstado))
      await invalidarJerarquia(queryClient)
    },
    onError: (e) => setError(e.message),
  })

  const borrado = useMutation({
    mutationFn: (item: T) => config.borrar(item.id),
    onSuccess: (_, item) => {
      // Primero se cierra y se avisa (o se navega), y recién después se refrescan las listas: si se esperara
      // la invalidación, el detalle del elemento borrado parpadearía en "no encontrado".
      setABorrar(null)
      const mensaje = mensajeBorrado(item.nombre)
      if (alBorrado) alBorrado(item, mensaje)
      else alMensaje(mensaje)
      void invalidarJerarquia(queryClient)
    },
    onError: (e) => setErrorBorrado(e.message),
  })

  return {
    dialogo,
    abrirCrear: () => setDialogo({}),
    abrirEditar: (item) => setDialogo({ item }),
    cerrarDialogo: () => setDialogo(null),
    cambiarEstado: (item, nuevo) => {
      setError(null)
      estado.mutate({ item, nuevo })
    },
    pedirBorrado: (item) => {
      setErrorBorrado(null)
      setABorrar(item)
    },
    pendiente: estado.isPending || borrado.isPending,
    error,
    borrado: aBorrar
      ? {
          item: aBorrar,
          error: errorBorrado,
          pendiente: borrado.isPending,
          confirmar: () => {
            setErrorBorrado(null)
            borrado.mutate(aBorrar)
          },
          cancelar: () => setABorrar(null),
        }
      : null,
  }
}
