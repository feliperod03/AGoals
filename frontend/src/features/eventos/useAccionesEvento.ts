import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarEvento, borrarEvento, crearEvento } from '@/api/eventos'
import { actualizarRecordatorio } from '@/api/recordatorios'
import { requestMovido } from '@/features/agenda/recordatorioForm'
import {
  mensajeEventoBorrado,
  mensajeEventoCreado,
  mensajeEventoGuardado,
  mensajeEventoGuardadoConRecordatorio,
  mensajeEventoRecordatorioNoMovido,
  mensajeEventoYaNoExistia,
} from '@/lib/fechas'
import type { Evento, EventoRequest } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import type { ValoresEvento } from './formularioEvento'
import { instanteMovido } from './moverRecordatorio'

/** `{ iniciales }` = diálogo para crear con esos valores; `{ evento }` = para editar ese evento entero. */
export type EstadoEventoDialog = { evento: Evento; iniciales?: undefined } | { evento?: undefined; iniciales: ValoresEvento }

export interface AccionesEvento {
  dialogo: EstadoEventoDialog | null
  abrirCrear: (iniciales: ValoresEvento) => void
  abrirEditar: (evento: Evento) => void
  cerrarDialogo: () => void
  /**
   * Crea (diálogo de creación) o reemplaza (diálogo de edición) con el cuerpo completo.
   * `recordatorio` (solo al editar): el del evento, para moverlo con el inicio (9e). Se mueve únicamente si no fue
   * enviado y el instante de inicio cambió; si no, se ignora. Primero va el PUT del evento y después el del recordatorio.
   */
  guardar: (request: EventoRequest, recordatorio?: Recordatorio) => void
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
  /** Evento cuyo recordatorio se está editando (9d), en un diálogo abierto encima de la edición. */
  recordatorioDe: Evento | null
  pedirRecordatorio: (evento: Evento) => void
  cerrarRecordatorio: () => void
  /** Elemento que tenía el foco al pedir el recordatorio («Recordatorio…»): ahí vuelve al cerrarlo. */
  disparadorRecordatorio: { current: HTMLElement | null }
  /** Aviso flotante de la página, para el diálogo de recordatorio. */
  alMensaje: (mensaje: string) => void
}

interface Opciones {
  /** Confirmación para el aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
  /** Tras crear (con el refresco ya hecho): la página salta al día del evento. */
  alCrear?: (evento: Evento) => void
}

const esStatus = (e: unknown, status: number) => e instanceof ApiError && e.status === status

/** Qué pasó con el recordatorio al guardar: `null` = no se intentó moverlo. */
type Movido = { ok: true; fechaHora: string } | { ok: false; motivo: string } | null

interface Variables {
  id?: number
  request: EventoRequest
  /** Inicio del evento abierto al llamar a `guardar` (el que tenía antes de este PUT). */
  inicioViejo?: string
  recordatorio?: Recordatorio
}

/**
 * PUT del evento y, si hay un recordatorio pendiente y el inicio cambió, PUT del recordatorio con los cinco campos y
 * la misma distancia al inicio. Si el segundo falla el evento ya quedó guardado: no se relanza ni se reintenta, el
 * mensaje del servidor llega al aviso.
 */
async function guardarEvento({ id, request, inicioViejo, recordatorio }: Variables): Promise<{ evento: Evento; movido: Movido }> {
  if (id === undefined) return { evento: await crearEvento(request), movido: null }
  const evento = await actualizarEvento(id, request)
  const nuevo = recordatorio && inicioViejo ? instanteMovido(recordatorio, inicioViejo, request.fechaHoraInicio) : null
  if (!recordatorio || !nuevo) return { evento, movido: null }
  try {
    const r = await actualizarRecordatorio(recordatorio.id, requestMovido(recordatorio, nuevo))
    return { evento, movido: { ok: true, fechaHora: r.fechaHora } }
  } catch (e) {
    return { evento, movido: { ok: false, motivo: e instanceof Error ? e.message : 'error desconocido' } }
  }
}

/**
 * Crear, editar y borrar eventos (9c), y abrir el recordatorio del evento (9d; la mutación es la de `RecordatorioDialog`). Una sola mutación a la vez: el guard es un `useRef` (no `isPending`, que se
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
  const [recordatorioDe, setRecordatorioDe] = useState<Evento | null>(null)
  const enCurso = useRef(false)
  const disparador = useRef<HTMLElement | null>(null)
  const disparadorBorrado = useRef<HTMLElement | null>(null)
  const disparadorRecordatorio = useRef<HTMLElement | null>(null)

  const invalidarEventos = () => queryClient.invalidateQueries({ queryKey: ['eventos'] })
  const invalidarTodo = () => Promise.all([invalidarEventos(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
  const liberar = () => {
    enCurso.current = false
  }

  const guardarMutacion = useMutation({
    mutationFn: guardarEvento,
    onSuccess: async ({ evento, movido }, { id }) => {
      // `['recordatorios']` solo si se intentó mover (haya salido bien o no): banner, Próximos y la consulta por evento.
      await Promise.all([invalidarEventos(), movido ? queryClient.invalidateQueries({ queryKey: ['recordatorios'] }) : null])
      setDialogo(null)
      const { titulo, fechaHoraInicio: inicio, fechaHoraFin: fin } = evento
      if (id === undefined) {
        alMensaje(mensajeEventoCreado(titulo, inicio, fin))
        alCrear?.(evento)
      } else if (movido?.ok) {
        alMensaje(mensajeEventoGuardadoConRecordatorio(titulo, inicio, fin, movido.fechaHora))
      } else if (movido) {
        alMensaje(mensajeEventoRecordatorioNoMovido(titulo, inicio, fin, movido.motivo))
      } else {
        alMensaje(mensajeEventoGuardado(titulo, inicio, fin))
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
    setRecordatorioDe(null)
    setDialogo(estado)
  }

  return {
    dialogo,
    abrirCrear: (iniciales) => abrir({ iniciales }),
    abrirEditar: (evento) => abrir({ evento }),
    cerrarDialogo: () => setDialogo(null),
    guardar: (request, recordatorio) =>
      lanzar(() =>
        guardarMutacion.mutate({ id: dialogo?.evento?.id, request, inicioViejo: dialogo?.evento?.fechaHoraInicio, recordatorio }),
      ),
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
    recordatorioDe,
    pedirRecordatorio: (evento) => {
      disparadorRecordatorio.current = enfocado()
      setRecordatorioDe(evento)
    },
    cerrarRecordatorio: () => setRecordatorioDe(null),
    disparadorRecordatorio,
    alMensaje,
  }
}
