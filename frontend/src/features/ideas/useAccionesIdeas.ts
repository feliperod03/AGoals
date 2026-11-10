import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarIdea, borrarIdea, concluirIdea, crearIdea, reabrirIdea } from '@/api/ideas'
import { mensajeIdeaBorrada, mensajeIdeaConcluida, mensajeIdeaCreada, mensajeIdeaGuardada, mensajeIdeaReabierta } from '@/lib/fechas'
import type { Idea, IdeaRequest } from '@/types/idea'
import { CLAVE_IDEAS } from './useIdeas'

/** `{}` = diálogo para crear; `{ idea }` = para editar. */
export interface EstadoIdeaDialog {
  idea?: Idea
}

/** Un diálogo de confirmación (concluir o borrar) con su error y su mutación en curso. */
export interface ConfirmacionIdea {
  idea: Idea
  /** Mensaje del servidor tal cual. El diálogo queda abierto con él. */
  error: string | null
  pendiente: boolean
  cancelar: () => void
}

export interface AccionesIdeas {
  dialogo: EstadoIdeaDialog | null
  abrirCrear: () => void
  abrirEditar: (idea: Idea) => void
  cerrarDialogo: () => void
  /** Crea (sin `idea`) o reemplaza (con `idea`) con el cuerpo completo. */
  guardar: (request: IdeaRequest, idea?: Idea) => void
  errorGuardar: string | null
  guardando: boolean
  concluir: (ConfirmacionIdea & { confirmar: (conclusion: string) => void }) | null
  pedirConcluir: (idea: Idea) => void
  /** Directo, sin diálogo. Su error sale en la página (`error`). */
  reabrir: (idea: Idea) => void
  borrado: (ConfirmacionIdea & { confirmar: () => void }) | null
  pedirBorrado: (idea: Idea) => void
  /** Hay una acción en curso: los controles se deshabilitan. */
  pendiente: boolean
  /** Último error de «Reabrir» (la única acción sin diálogo). */
  error: string | null
}

interface Opciones {
  /** Confirmación para el aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
}

/**
 * Acciones sobre ideas: crear/editar, concluir, reabrir y borrar. Una sola mutación a la vez: el guard es un
 * `useRef` (no `isPending`, que se actualiza en el siguiente render y dejaría pasar un doble clic) y se libera en
 * `onSettled`, o sea cuando terminó también el refresco posterior. Toda mutación invalida `['ideas']`.
 *
 * Errores: el mensaje del servidor se muestra en el diálogo, que queda abierto. Un 404 o 409 significa que la lista
 * estaba vieja (idea borrada o concluida en otra pestaña): se refresca. Un 400 al guardar suele ser un
 * proyecto/objetivo que ya no existe: se refrescan también esas listas para que salga de los candidatos.
 */
export function useAccionesIdeas({ alMensaje }: Opciones): AccionesIdeas {
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<EstadoIdeaDialog | null>(null)
  const [aConcluir, setAConcluir] = useState<Idea | null>(null)
  const [aBorrar, setABorrar] = useState<Idea | null>(null)
  const [errorReabrir, setErrorReabrir] = useState<string | null>(null)
  const enCurso = useRef(false)

  const invalidarIdeas = () => queryClient.invalidateQueries({ queryKey: CLAVE_IDEAS })
  const alFallar = async (e: Error, conListas = false) => {
    const status = e instanceof ApiError ? e.status : 0
    if (status === 404 || status === 409) await invalidarIdeas()
    if (conListas && status === 400) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proyectos'] }),
        queryClient.invalidateQueries({ queryKey: ['objetivos'] }),
        invalidarIdeas(),
      ])
    }
  }
  const liberar = () => {
    enCurso.current = false
  }

  const guardar = useMutation({
    mutationFn: ({ id, request }: { id?: number; request: IdeaRequest }) => (id === undefined ? crearIdea(request) : actualizarIdea(id, request)),
    onSuccess: async (_, { id, request }) => {
      setDialogo(null)
      alMensaje(id === undefined ? mensajeIdeaCreada(request.titulo) : mensajeIdeaGuardada(request.titulo))
      await invalidarIdeas()
    },
    onError: (e) => alFallar(e, true),
    onSettled: liberar,
  })

  const concluir = useMutation({
    mutationFn: ({ idea, conclusion }: { idea: Idea; conclusion: string }) => concluirIdea(idea.id, conclusion.trim() || undefined),
    onSuccess: async (_, { idea }) => {
      setAConcluir(null)
      alMensaje(mensajeIdeaConcluida(idea.titulo))
      await invalidarIdeas()
    },
    onError: (e) => alFallar(e),
    onSettled: liberar,
  })

  const reabrir = useMutation({
    mutationFn: (idea: Idea) => reabrirIdea(idea.id),
    onSuccess: async (_, idea) => {
      alMensaje(mensajeIdeaReabierta(idea.titulo))
      await invalidarIdeas()
    },
    onError: async (e) => {
      setErrorReabrir(e.message)
      await alFallar(e)
    },
    onSettled: liberar,
  })

  const borrar = useMutation({
    mutationFn: (idea: Idea) => borrarIdea(idea.id),
    onSuccess: async (_, idea) => {
      setABorrar(null)
      alMensaje(mensajeIdeaBorrada(idea.titulo))
      await invalidarIdeas()
    },
    onError: (e) => alFallar(e),
    onSettled: liberar,
  })

  /** Arranca una mutación solo si no hay otra en curso. */
  function lanzar(arrancar: () => void) {
    if (enCurso.current) return
    enCurso.current = true
    arrancar()
  }

  const pendiente = guardar.isPending || concluir.isPending || reabrir.isPending || borrar.isPending

  return {
    dialogo,
    abrirCrear: () => {
      guardar.reset()
      setDialogo({})
    },
    abrirEditar: (idea) => {
      guardar.reset()
      setDialogo({ idea })
    },
    cerrarDialogo: () => setDialogo(null),
    guardar: (request, idea) => lanzar(() => guardar.mutate({ id: idea?.id, request })),
    errorGuardar: guardar.error?.message ?? null,
    guardando: guardar.isPending,
    concluir: aConcluir
      ? {
          idea: aConcluir,
          error: concluir.error?.message ?? null,
          pendiente: concluir.isPending,
          confirmar: (conclusion) => lanzar(() => concluir.mutate({ idea: aConcluir, conclusion })),
          cancelar: () => setAConcluir(null),
        }
      : null,
    pedirConcluir: (idea) => {
      concluir.reset()
      setAConcluir(idea)
    },
    reabrir: (idea) =>
      lanzar(() => {
        setErrorReabrir(null)
        reabrir.mutate(idea)
      }),
    borrado: aBorrar
      ? {
          idea: aBorrar,
          error: borrar.error?.message ?? null,
          pendiente: borrar.isPending,
          confirmar: () => lanzar(() => borrar.mutate(aBorrar)),
          cancelar: () => setABorrar(null),
        }
      : null,
    pedirBorrado: (idea) => {
      borrar.reset()
      setABorrar(idea)
    },
    pendiente,
    error: errorReabrir,
  }
}
