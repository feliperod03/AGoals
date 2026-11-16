import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarEvento, borrarEvento, crearEvento } from '@/api/eventos'
import { actualizarRecordatorio } from '@/api/recordatorios'
import { borrarSerieDesde, crearSerie, editarSerieDesde } from '@/api/series'
import { requestMovido } from '@/features/agenda/recordatorioForm'
import {
  avisoYaNoEsDeSerieAlBorrar,
  avisoYaNoEsDeSerieAlEditar,
  mensajeEventoBorrado,
  mensajeEventoCreado,
  mensajeEventoGuardado,
  mensajeEventoGuardadoConRecordatorio,
  mensajeEventoGuardadoRecordatorioQueda,
  mensajeEventoRecordatorioNoMovido,
  mensajeEventoYaNoExistia,
  mensajeSerieBorrada,
  mensajeSerieCreada,
  mensajeSerieEditada,
} from '@/lib/fechas'
import type { Evento, EventoRequest } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import type { SerieEventoEdicionRequest, SerieEventoRequest } from '@/types/serie'
import type { Alcance } from './ElegirAlcance'
import type { ValoresEvento } from './formularioEvento'
import type { AlMensaje } from '@/features/agenda/useMensajeTemporal'
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
   * `quedaEn` (solo al editar, con la casilla desmarcada): cuándo queda el recordatorio sin moverse; solo se usa para el aviso.
   */
  guardar: (request: EventoRequest, recordatorio?: Recordatorio, quedaEn?: string) => void
  /** Crea una serie (diálogo de creación con «Repetir»): una sola llamada atómica que crea todos los eventos. */
  guardarSerie: (request: SerieEventoRequest) => void
  /**
   * Edita el evento abierto y los siguientes de su serie («Este y los siguientes»). Si el servidor dice 409 (el evento ya
   * no es de una serie) el diálogo sigue abierto con `serieId: null` y se llama `alYaNoEsDeSerie`, para que el formulario
   * vuelva a «solo este evento». No se guarda nada a ciegas.
   */
  guardarSerieDesde: (request: SerieEventoEdicionRequest, alYaNoEsDeSerie?: () => void) => void
  guardando: boolean
  /** Mensaje del servidor tal cual; el diálogo queda abierto con él. */
  errorGuardar: string | null
  /** Aviso del 409 al guardar «este y los siguientes»: el diálogo sigue abierto y hay que revisar y guardar de nuevo. */
  avisoGuardar: string | null
  /** Confirmación de borrado, abierta encima de la edición. */
  borrado: Evento | null
  pedirBorrado: (evento: Evento) => void
  cancelarBorrado: () => void
  /**
   * `conRecordatorio`: lo que se sabía al confirmar, solo para el texto del aviso. `alcance` (por defecto `'este'`):
   * `'siguientes'` borra este evento y los siguientes de su serie.
   */
  borrar: (conRecordatorio: boolean, alcance?: Alcance) => void
  borrando: boolean
  errorBorrar: string | null
  /** Si el evento dejó de ser de una serie (409): el diálogo sigue abierto, sin alcance, y pide confirmar de nuevo. */
  avisoBorrar: string | null
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
  alMensaje: AlMensaje
}

interface Opciones {
  /** Confirmación para el aviso flotante de la página. */
  alMensaje: AlMensaje
  /** Tras crear (con el refresco ya hecho): la página salta al día del evento. */
  alCrear?: (evento: Evento) => void
  /** Tras editar bien (con el refresco ya hecho): la página puede llevar al día del evento si quedó fuera de lo que se ve. */
  alGuardar?: (evento: Evento) => void
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
  /** Instante (ISO) en que queda el recordatorio si no se movió aunque cambió el inicio: solo para el aviso. */
  quedaEn?: string
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

/** ¿Es la consulta `['recordatorios', { eventoId }]` de ese evento? */
function esConsultaDelEvento(clave: readonly unknown[], eventoId: number): boolean {
  const filtro = clave[1]
  return typeof filtro === 'object' && filtro !== null && 'eventoId' in filtro && filtro.eventoId === eventoId
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
export function useAccionesEvento({ alMensaje, alCrear, alGuardar }: Opciones): AccionesEvento {
  const queryClient = useQueryClient()
  const [dialogo, setDialogo] = useState<EstadoEventoDialog | null>(null)
  const [aBorrar, setABorrar] = useState<Evento | null>(null)
  const [recordatorioDe, setRecordatorioDe] = useState<Evento | null>(null)
  const [avisoBorrar, setAvisoBorrar] = useState<string | null>(null)
  const [avisoGuardar, setAvisoGuardar] = useState<string | null>(null)
  const enCurso = useRef(false)
  const disparador = useRef<HTMLElement | null>(null)
  const disparadorBorrado = useRef<HTMLElement | null>(null)
  const disparadorRecordatorio = useRef<HTMLElement | null>(null)

  const invalidarEventos = () => queryClient.invalidateQueries({ queryKey: ['eventos'] })
  /**
   * Tras borrar: la consulta `['recordatorios', { eventoId }]` del evento borrado sigue montada (los diálogos aún
   * están abiertos) y refrescarla pediría los recordatorios de algo que ya no existe. Se marca obsoleta SIN refetch;
   * el resto de `['recordatorios']` (banner de vencidos, Próximos) se refresca como siempre.
   */
  const invalidarTrasBorrar = (eventoId: number) =>
    Promise.all([
      invalidarEventos(),
      queryClient.invalidateQueries({ queryKey: ['recordatorios'], predicate: (q) => !esConsultaDelEvento(q.queryKey, eventoId) }),
      queryClient.invalidateQueries({ queryKey: ['recordatorios'], predicate: (q) => esConsultaDelEvento(q.queryKey, eventoId), refetchType: 'none' }),
    ])
  const invalidarTodo = () => Promise.all([invalidarEventos(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
  const liberar = () => {
    enCurso.current = false
  }

  const guardarMutacion = useMutation({
    mutationFn: guardarEvento,
    onSuccess: async ({ evento, movido }, { id, quedaEn }) => {
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
        // Fallo parcial: el evento sí quedó guardado. El aviso no expira para que no pase desapercibido.
        alMensaje(mensajeEventoRecordatorioNoMovido(titulo, inicio, fin, movido.motivo), { persistente: true })
      } else if (quedaEn) {
        alMensaje(mensajeEventoGuardadoRecordatorioQueda(titulo, inicio, fin, quedaEn))
      } else {
        alMensaje(mensajeEventoGuardado(titulo, inicio, fin))
      }
      if (id !== undefined) alGuardar?.(evento)
    },
    onError: async (e) => {
      if (esStatus(e, 404)) await invalidarTodo()
    },
    onSettled: liberar,
  })

  /** Crear una serie: el servidor la crea entera o no crea nada, así que no hay fallo parcial posible. */
  const serieMutacion = useMutation({
    mutationFn: (request: SerieEventoRequest) => crearSerie(request),
    onSuccess: async ({ eventos, recordatoriosOmitidos }, request) => {
      // Los recordatorios de cada ocurrencia se crean con la serie: banner, Próximos y consultas por evento.
      await Promise.all([invalidarEventos(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
      setDialogo(null)
      const primero = eventos[0]
      const ultimo = eventos[eventos.length - 1]
      if (!primero || !ultimo) return
      const minutosAntes = request.recordatorio ? (request.recordatorio.minutosAntes ?? 60) : null
      // Si algún recordatorio se omitió, lo principal salió pero algo pedido no: aviso persistente (R3).
      alMensaje(mensajeSerieCreada(request.titulo, primero.fechaHoraInicio, ultimo.fechaHoraInicio, eventos.length, minutosAntes, recordatoriosOmitidos), {
        persistente: recordatoriosOmitidos > 0,
      })
      alCrear?.(primero)
    },
    onSettled: liberar,
  })

  /**
   * Editar este evento y los siguientes: una sola llamada atómica (o se editan todos o ninguno). Un 404 (el evento o su
   * serie ya no existe) cierra el diálogo con «ya no existía»; un 409 (ya no es de una serie) deja el diálogo abierto.
   */
  const serieDesdeMutacion = useMutation({
    mutationFn: async ({ evento, request }: { evento: Evento; request: SerieEventoEdicionRequest; alYaNoEsDeSerie?: () => void }) => {
      try {
        return { tipo: 'editada' as const, ...(await editarSerieDesde(evento.id, request)) }
      } catch (e) {
        if (esStatus(e, 404)) return { tipo: 'yaNoExistia' as const }
        if (esStatus(e, 409)) return { tipo: 'yaNoEsDeSerie' as const }
        throw e
      }
    },
    onSuccess: async (resultado, { evento, request, alYaNoEsDeSerie }) => {
      if (resultado.tipo === 'yaNoExistia') {
        await invalidarTrasBorrar(evento.id)
        setDialogo(null)
        alMensaje(mensajeEventoYaNoExistia(evento.titulo))
        return
      }
      if (resultado.tipo === 'yaNoEsDeSerie') {
        await invalidarTodo()
        setDialogo((d) => (d?.evento && d.evento.id === evento.id ? { evento: { ...d.evento, serieId: null } } : d))
        setAvisoGuardar(avisoYaNoEsDeSerieAlEditar())
        alYaNoEsDeSerie?.()
        return
      }
      // Los recordatorios de las ocurrencias cambian con la serie: banner, Próximos y consultas por evento.
      await invalidarTodo()
      setDialogo(null)
      const { eventos, recordatoriosOmitidos } = resultado
      const primero = eventos[0]
      const ultimo = eventos[eventos.length - 1]
      if (!primero || !ultimo) return
      const minutosAntes = request.recordatorio ? (request.recordatorio.minutosAntes ?? 60) : null
      // Un recordatorio omitido quedó a su hora vieja: lo principal salió pero algo pedido no (R3), aviso persistente.
      alMensaje(
        mensajeSerieEditada(request.titulo, primero.fechaHoraInicio, ultimo.fechaHoraInicio, eventos.length, minutosAntes, recordatoriosOmitidos),
        { persistente: recordatoriosOmitidos > 0 },
      )
      alGuardar?.(primero)
    },
    onSettled: liberar,
  })

  const borrarMutacion = useMutation({
    // Un 404 al borrar no es un error para el usuario: el evento ya no está. Un 409 de «este y los siguientes» es que
    // el evento dejó de ser de una serie: no se borra nada y se pide confirmar de nuevo (solo él).
    mutationFn: async ({ evento, alcance }: { evento: Evento; conRecordatorio: boolean; alcance: Alcance }) => {
      try {
        if (alcance === 'siguientes') await borrarSerieDesde(evento.id)
        else await borrarEvento(evento.id)
        return alcance === 'siguientes' ? ('serieBorrada' as const) : ('borrado' as const)
      } catch (e) {
        if (esStatus(e, 404)) return 'yaNoExistia' as const
        if (alcance === 'siguientes' && esStatus(e, 409)) return 'yaNoEsDeSerie' as const
        throw e
      }
    },
    onSuccess: async (resultado, { evento, conRecordatorio }) => {
      if (resultado === 'yaNoEsDeSerie') {
        await invalidarEventos()
        const suelto = (e: Evento | null) => (e && e.id === evento.id ? { ...e, serieId: null } : e)
        setABorrar(suelto)
        setDialogo((d) => (d?.evento && d.evento.id === evento.id ? { evento: { ...d.evento, serieId: null } } : d))
        setAvisoBorrar(avisoYaNoEsDeSerieAlBorrar())
        return
      }
      await invalidarTrasBorrar(evento.id)
      setABorrar(null)
      setDialogo(null)
      if (resultado === 'serieBorrada') alMensaje(mensajeSerieBorrada(evento.titulo))
      else alMensaje(resultado === 'borrado' ? mensajeEventoBorrado(evento.titulo, conRecordatorio) : mensajeEventoYaNoExistia(evento.titulo))
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
    serieMutacion.reset()
    serieDesdeMutacion.reset()
    setAvisoGuardar(null)
    setABorrar(null)
    setRecordatorioDe(null)
    setDialogo(estado)
  }

  return {
    dialogo,
    abrirCrear: (iniciales) => abrir({ iniciales }),
    abrirEditar: (evento) => abrir({ evento }),
    cerrarDialogo: () => setDialogo(null),
    guardar: (request, recordatorio, quedaEn) =>
      lanzar(() =>
        guardarMutacion.mutate({ id: dialogo?.evento?.id, request, inicioViejo: dialogo?.evento?.fechaHoraInicio, recordatorio, quedaEn }),
      ),
    guardarSerie: (request) => lanzar(() => serieMutacion.mutate(request)),
    guardarSerieDesde: (request, alYaNoEsDeSerie) => {
      const evento = dialogo?.evento
      // Sin evento abierto, o ya suelto (409 previo): no hay serie que editar. El formulario no debería llamarlo así.
      if (!evento || evento.serieId === null) return
      lanzar(() => {
        // El aviso del 409 vale para el intento anterior: al reintentar se limpia.
        setAvisoGuardar(null)
        serieDesdeMutacion.mutate({ evento, request, alYaNoEsDeSerie })
      })
    },
    guardando: guardarMutacion.isPending || serieMutacion.isPending || serieDesdeMutacion.isPending,
    errorGuardar: guardarMutacion.error?.message ?? serieMutacion.error?.message ?? serieDesdeMutacion.error?.message ?? null,
    avisoGuardar,
    borrado: aBorrar,
    pedirBorrado: (evento) => {
      disparadorBorrado.current = enfocado()
      borrarMutacion.reset()
      setAvisoBorrar(null)
      setABorrar(evento)
    },
    cancelarBorrado: () => setABorrar(null),
    borrar: (conRecordatorio, alcance = 'este') => {
      const evento = aBorrar
      if (!evento) return
      // El aviso del 409 vale para la confirmación anterior: al reintentar se limpia (R2).
      setAvisoBorrar(null)
      lanzar(() => borrarMutacion.mutate({ evento, conRecordatorio, alcance: evento.serieId === null ? 'este' : alcance }))
    },
    borrando: borrarMutacion.isPending,
    errorBorrar: borrarMutacion.error?.message ?? null,
    avisoBorrar,
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
