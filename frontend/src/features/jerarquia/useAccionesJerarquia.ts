import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { Elecciones } from '@/types/impactoBorrado'
import type { Estado } from '@/types/tarea'
import type { ConfigJerarquia } from './config'
import type { FiltroEstado } from './filtros'
import type { ValoresItem } from './formulario'
import { mensajeBorrado, mensajeEstadoCambiado } from './mensajes'
import type { ItemJerarquico } from './tipos'
import { CLAVE_IMPACTO_BORRADO } from './useImpactoBorrado'

/**
 * Tras toda mutación de proyecto u objetivo se refrescan las DOS listas: son chicas y así no hay que razonar
 * caso por caso (el nombre de un objetivo se ve en los proyectos, y los proyectos de un objetivo en su detalle).
 * Ninguna de estas mutaciones toca tareas; el borrado sí puede hacerlo y usa `invalidarTrasBorrado`.
 */
export function invalidarJerarquia(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['proyectos'] }),
    queryClient.invalidateQueries({ queryKey: ['objetivos'] }),
  ])
}

/**
 * Tras borrar un proyecto u objetivo, además de las dos listas: el borrado puede haber borrado tareas (o
 * dejarlas sueltas), así que se refrescan las tareas (incluida `['tareas','todas']`), la agenda y los recordatorios.
 */
export function invalidarTrasBorrado(queryClient: QueryClient) {
  return Promise.all([
    invalidarJerarquia(queryClient),
    queryClient.invalidateQueries({ queryKey: ['tareas'] }),
    queryClient.invalidateQueries({ queryKey: ['agenda'] }),
    queryClient.invalidateQueries({ queryKey: ['recordatorios'] }),
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
  /** Valores que pisan a los de un formulario nuevo (p. ej. `objetivoId` al crear desde el detalle de un objetivo). */
  iniciales?: Partial<ValoresItem>
}

/** Lo que manda el diálogo al confirmar un borrado con elecciones; sin esto, DELETE sin parámetros. */
export interface OpcionesBorrado {
  /** Un valor explícito por cada fila visible del diálogo. */
  elecciones: Elecciones
  /** Lo demás que se borra, para el aviso: «2 proyectos», «5 tareas». */
  tambien: string[]
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
    /** Mensaje del servidor tal cual (p. ej. un 409 si falta la elección de una categoría con elementos). */
    error: string | null
    pendiente: boolean
    confirmar: (opciones?: OpcionesBorrado) => void
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
    mutationFn: ({ item, opciones }: { item: T; opciones?: OpcionesBorrado }) =>
      // Sin elecciones se llama con un solo argumento: DELETE sin parámetros.
      opciones ? config.borrar(item.id, opciones.elecciones) : config.borrar(item.id),
    onSuccess: (_, { item, opciones }) => {
      // Primero se cierra y se avisa (o se navega), y recién después se refrescan las listas: si se esperara
      // la invalidación, el detalle del elemento borrado parpadearía en "no encontrado".
      setABorrar(null)
      const mensaje = mensajeBorrado(item.nombre, opciones?.tambien)
      if (alBorrado) alBorrado(item, mensaje)
      else alMensaje(mensaje)
      void invalidarTrasBorrado(queryClient)
    },
    onError: (e) => {
      setErrorBorrado(e.message)
      // Los datos cambiaron desde que se calculó la vista previa: se vuelve a pedir.
      void queryClient.invalidateQueries({ queryKey: [CLAVE_IMPACTO_BORRADO] })
    },
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
          confirmar: (opciones) => {
            setErrorBorrado(null)
            borrado.mutate({ item: aBorrar, opciones })
          },
          cancelar: () => setABorrar(null),
        }
      : null,
  }
}
