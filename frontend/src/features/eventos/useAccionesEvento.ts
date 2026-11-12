import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarEvento, borrarEvento, crearEvento } from '@/api/eventos'
import { mensajeEventoBorrado, mensajeEventoCreado, mensajeEventoGuardado, mensajeEventoYaNoExistia } from '@/lib/fechas'
import type { Evento, EventoRequest } from '@/types/evento'
import type { ValoresEvento } from './formularioEvento'

/** `{ iniciales }` = diálogo para crear con esos valores; `{ evento }` = para editar ese evento entero. */
export type EstadoEventoDialog = { evento: Evento; iniciales?: undefined } | { evento?: undefined; iniciales: ValoresEvento }

export interface AccionesEvento {
  dialogo: EstadoEventoDialog | null
  abrirCrear: (iniciales: ValoresEvento) => void
  abrirEditar: (evento: Evento) => void
  cerrarDialogo: () => void
  /** Crea (diálogo de creación) o reemplaza (diálogo de edición) con el cuerpo completo. */
  guardar: (request: EventoRequest) => void
  guardando: boolean
  /** Mensaje del servidor tal cual; el diálogo queda abierto con él. */
  errorGuardar: string | null
  /** Confirmación de borrado, abierta encima de la edición. */
  borrado: Evento | null
  pedirBorrado: (evento: Evento) => void
  cancelarBorrado: () => void
  /** `conRecordatorio`: lo que se sabía al confirmar, solo para el texto del aviso. */
  borrar: (conRecordatorio: boolean) => void
  borrando: boolean
  errorBorrar: string | null
  /**
   * Elemento que tenía el foco al abrir el diálogo. Al cerrar, Radix lo devuelve ahí; si ya no está en la página
   * (el bloque se borró o cambió de día), la página decide a dónde va.
   */
  disparador: { current: HTMLElement | null }
  /** Elemento que tenía el foco al pedir el borrado («Borrar evento»): ahí vuelve al cancelar la confirmación. */
  disparadorBorrado: { current: HTMLElement | null }
}

interface Opciones {
  /** Confirmación para el aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
  /** Tras crear (con el refresco ya hecho): la página salta al día del evento. */
  alCrear?: (evento: Evento) => void
}

const esStatus = (e: unknown, status: number) => e instanceof ApiError && e.status === status

/**
 * Crear, editar y borrar eventos (9c). Una sola mutación a la vez: el guard es un `useRef` (no `isPending`, que se
 * actualiza en el siguiente render y dejaría pasar un doble clic) y se libera en `onSettled`.
 *
 * Al terminar bien, primero se espera el refresco y DESPUÉS se cierra el diálogo: así, cuando Radix devuelve el foco,
 * la página ya muestra el resultado y se sabe si el elemento que abrió el diálogo sigue existiendo.
 *
 * Invalidación: `['eventos']` cubre el calendario (rango), Hoy (día y próximos) y `['eventos', id]` (el título de un
 * recordatorio sin descripción). Borrar también invalida `['recordatorios']`, porque la base borra en cascada el del
 * evento (banner de vencidos, Próximos recordatorios). Un 404 (borrado en otra pestaña) refresca las dos; al borrar,
 * un 404 ya cumplió el objetivo y se cierra con «El evento «X» ya no existía».
 */
export function useAccionesEvento({ alMensaje, alCrear }: Opciones): AccionesEvento {
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<EstadoEventoDialog | null>(null)
  const [aBorrar, setABorrar] = useState<Evento | null>(null)
  const enCurso = useRef(false)
  const disparador = useRef<HTMLElement | null>(null)
  const disparadorBorrado = useRef<HTMLElement | null>(null)

  const invalidarEventos = () => queryClient.invalidateQueries({ queryKey: ['eventos'] })
  const invalidarTodo = () => Promise.all([invalidarEventos(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
  const liberar = () => {
    enCurso.current = false
  }

  const guardarMutacion = useMutation({
    mutationFn: ({ id, request }: { id?: number; request: EventoRequest }) => (id === undefined ? crearEvento(request) : actualizarEvento(id, request)),
    onSuccess: async (evento, { id }) => {
      await invalidarEventos()
      setDialogo(null)
      if (id === undefined) {
        alMensaje(mensajeEventoCreado(evento.titulo, evento.fechaHoraInicio, evento.fechaHoraFin))
        alCrear?.(evento)
      } else {
        alMensaje(mensajeEventoGuardado(evento.titulo, evento.fechaHoraInicio, evento.fechaHoraFin))
      }
    },
    onError: async (e) => {
      if (esStatus(e, 404)) await invalidarTodo()
    },
    onSettled: liberar,
  })

  const borrarMutacion = useMutation({
    // Un 404 al borrar no es un error para el usuario: el evento ya no está.
    mutationFn: async ({ evento }: { evento: Evento; conRecordatorio: boolean }) => {
      try {
        await borrarEvento(evento.id)
        return 'borrado' as const
      } catch (e) {
        if (esStatus(e, 404)) return 'yaNoExistia' as const
        throw e
      }
    },
    onSuccess: async (resultado, { evento, conRecordatorio }) => {
      await invalidarTodo()
      setABorrar(null)
      setDialogo(null)
      alMensaje(resultado === 'borrado' ? mensajeEventoBorrado(evento.titulo, conRecordatorio) : mensajeEventoYaNoExistia(evento.titulo))
    },
    onSettled: liberar,
  })

  /** Arranca una mutación solo si no hay otra en curso. */
  function lanzar(arrancar: () => void) {
    if (enCurso.current) return
    enCurso.current = true
    arrancar()
  }

  const enfocado = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null)

  function abrir(estado: EstadoEventoDialog) {
    disparador.current = enfocado()
    guardarMutacion.reset()
    setABorrar(null)
    setDialogo(estado)
  }

  return {
    dialogo,
    abrirCrear: (iniciales) => abrir({ iniciales }),
    abrirEditar: (evento) => abrir({ evento }),
    cerrarDialogo: () => setDialogo(null),
    guardar: (request) => lanzar(() => guardarMutacion.mutate({ id: dialogo?.evento?.id, request })),
    guardando: guardarMutacion.isPending,
    errorGuardar: guardarMutacion.error?.message ?? null,
    borrado: aBorrar,
    pedirBorrado: (evento) => {
      disparadorBorrado.current = enfocado()
      borrarMutacion.reset()
      setABorrar(evento)
    },
    cancelarBorrado: () => setABorrar(null),
    borrar: (conRecordatorio) => {
      const evento = aBorrar
      if (evento) lanzar(() => borrarMutacion.mutate({ evento, conRecordatorio }))
    },
    borrando: borrarMutacion.isPending,
    errorBorrar: borrarMutacion.error?.message ?? null,
    disparador,
    disparadorBorrado,
  }
}
