import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { actualizarRecordatorio, borrarRecordatorio, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, borrarTarea, marcarHecha, posponerTarea, reabrirTarea } from '@/api/tareas'
import {
  diasEntre,
  mensajeBorrada,
  mensajeMadreCambiada,
  mensajePospuesta,
  mensajeRecordatorioMovido,
  mensajeRecordatorioNoMovido,
  mensajeSinFecha,
  mensajeSinFechaConRecordatorio,
  moverInstanteDias,
} from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'
import type { ModoSubtareas, Tarea } from '@/types/tarea'
import { requestConEstado, requestConPadre, requestSinFecha } from './formularioTarea'
import { requestMovido } from './recordatorioForm'
import { CLAVE_TODAS_LAS_TAREAS } from './useTodasLasTareas'

export type TipoAccion = 'hecha' | 'reabrir' | 'posponer' | 'sinFecha' | 'cancelar' | 'reactivar'

export interface EleccionBorrado {
  modo: ModoSubtareas
  subtareas: number
}

export interface Acciones {
  /**
   * Ejecuta la acción y, si sale bien, avisa y cierra el diálogo de edición de esa tarea.
   * `fecha` (YYYY-MM-DD) solo la usa `'posponer'`, que siempre la manda explícita.
   * `recordatorio` (opcional) es el recordatorio pendiente de la tarea: en `'posponer'` se mueve los mismos días
   * que la tarea; en `'sinFecha'` NO se toca, solo cambia el texto del aviso. Si ya fue enviado se ignora.
   */
  ejecutar: (tipo: TipoAccion, tarea: Tarea, fecha?: string, recordatorio?: Recordatorio) => void
  /** Abre el selector de posponer (Mañana / Elegir fecha / Dejar sin fecha) para esa tarea. */
  pedirPosponer: (tarea: Tarea) => void
  /** Selector abierto; se cierra solo cuando la acción sale bien y sigue abierto si falla. */
  posponer: { tarea: Tarea; cancelar: () => void } | null
  /**
   * Abre la elección "Crear una nueva / Vincular una existente" para `madre` (encima del diálogo de edición,
   * si había uno; este solo se reemplaza al elegir crear).
   */
  pedirSubtarea: (madre: Tarea) => void
  /** Diálogo de elección abierto; se cierra al crear, al vincular con éxito o al cancelar, y sigue abierto si falla. */
  subtarea: {
    madre: Tarea
    error: string | null
    pendiente: boolean
    /** Cierra la elección y abre la creación de una subtarea nueva (flujo de 8.2d). */
    crearNueva: () => void
    /** PUT de `tarea` con `padreId` = la madre; reenvía todos sus campos. */
    vincular: (tarea: Tarea) => void
    cancelar: () => void
  } | null
  /** Abre «Proyecto y objetivo de «X»» (encima del diálogo de edición, si había uno). La mutación vive en el diálogo. */
  pedirVinculo: (tarea: Tarea) => void
  /** Diálogo abierto; `alMensaje` es el aviso de la página donde se abrió. */
  vinculo: { tarea: Tarea; cancelar: () => void; alMensaje: (mensaje: string) => void } | null
  /** Abre «Recordatorio de «X»» (encima del diálogo de edición, si había uno). La mutación vive en el diálogo. */
  pedirRecordatorio: (tarea: Tarea) => void
  /** Diálogo abierto; `alMensaje` es el aviso de la página donde se abrió. */
  recordatorioTarea: { tarea: Tarea; cancelar: () => void; alMensaje: (mensaje: string) => void } | null
  /** Abre la confirmación de borrado (el DELETE solo se manda al confirmar). */
  pedirBorrado: (tarea: Tarea) => void
  /** Hay una acción en curso: los botones se deshabilitan. */
  pendiente: boolean
  /** Último error legible de una acción (400/404/409); se limpia al lanzar otra. */
  error: string | null
  /**
   * `confirmar()` sin argumento = borrado simple (sin `?subtareas=`). Con `eleccion`, manda el modo y usa
   * `subtareas` (total de descendientes) solo para el aviso.
   */
  confirmarBorrado: {
    tarea: Tarea
    error: string | null
    pendiente: boolean
    confirmar: (eleccion?: EleccionBorrado) => void
    cancelar: () => void
  } | null
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
  /** Se eligió crear una subtarea nueva de `madre`: la página abre el diálogo de creación con ese padre. */
  alSubtarea: (madre: Tarea) => void
}

const MENSAJES = {
  hecha: 'Marcada como hecha',
  reabrir: 'Reabierta',
  cancelar: 'Tarea cancelada',
  reactivar: 'Reactivada',
  sinFecha: mensajeSinFecha(),
} as const

/**
 * Resultado de la mutación. Solo 'posponer' y 'sinFecha' lo usan más allá de `tarea`: `recordatorioMovido` es el
 * recordatorio ya movido y `fallo` el mensaje del servidor si la tarea se pospuso pero el recordatorio no.
 */
interface ResultadoAccion {
  tarea: Tarea
  recordatorioMovido: Recordatorio | null
  fallo: string | null
}

/** El recordatorio solo cuenta si existe y no fue enviado (guarda propia, además de la del diálogo). */
function pendienteDe(recordatorio?: Recordatorio): Recordatorio | undefined {
  return recordatorio && !recordatorio.enviado ? recordatorio : undefined
}

function soloTarea(promesa: Promise<Tarea>): Promise<ResultadoAccion> {
  return promesa.then((tarea) => ({ tarea, recordatorioMovido: null, fallo: null }))
}

/** PATCH de posponer y, si hay un recordatorio pendiente, PUT con la fecha corrida los mismos días de calendario. */
async function posponerConRecordatorio(tarea: Tarea, fecha: string, recordatorio?: Recordatorio): Promise<ResultadoAccion> {
  const actualizada = await posponerTarea(tarea.id, fecha)
  const mover = pendienteDe(recordatorio)
  if (!mover || !tarea.fecha || !actualizada.fecha) return { tarea: actualizada, recordatorioMovido: null, fallo: null }
  try {
    const nueva = moverInstanteDias(mover.fechaHora, diasEntre(tarea.fecha, actualizada.fecha))
    const movido = await actualizarRecordatorio(mover.id, requestMovido(mover, nueva))
    return { tarea: actualizada, recordatorioMovido: movido, fallo: null }
  } catch (e) {
    // La tarea ya cambió: no se relanza. El mensaje del servidor llega al aviso.
    return { tarea: actualizada, recordatorioMovido: null, fallo: e instanceof Error ? e.message : 'error desconocido' }
  }
}

function ejecutarAccion(tipo: TipoAccion, tarea: Tarea, fecha?: string, recordatorio?: Recordatorio): Promise<ResultadoAccion> {
  switch (tipo) {
    case 'hecha':
      return soloTarea(marcarHecha(tarea.id))
    case 'reabrir':
      return soloTarea(reabrirTarea(tarea.id))
    case 'posponer':
      if (!fecha) return Promise.reject(new Error('Falta la fecha para posponer.'))
      return posponerConRecordatorio(tarea, fecha, recordatorio)
    case 'sinFecha':
      // El recordatorio no se toca: solo se usa en onSuccess para el texto del aviso.
      return soloTarea(actualizarTarea(tarea.id, requestSinFecha(tarea)))
    case 'cancelar':
      return soloTarea(actualizarTarea(tarea.id, requestConEstado(tarea, 'CANCELADO')))
    case 'reactivar':
      return soloTarea(actualizarTarea(tarea.id, requestConEstado(tarea, 'PENDIENTE')))
  }
}

/**
 * Acciones rápidas sobre una tarea. Una sola mutación a la vez (`pendiente` deshabilita todos los botones).
 * Al marcar hecha o cancelar consulta si la tarea tiene un recordatorio sin enviar y, si lo hay, deja
 * `preguntaRecordatorio` para que la página pregunte si se borra o se conserva.
 */
export function useAccionesTarea({ alMensaje, alTerminar, alSubtarea }: Opciones): Acciones {
  const queryClient = useQueryClient()
  const enCurso = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [aPosponer, setAPosponer] = useState<Tarea | null>(null)
  const [aSubtarea, setASubtarea] = useState<Tarea | null>(null)
  const [errorSubtarea, setErrorSubtarea] = useState<string | null>(null)
  const [aVincular, setAVincular] = useState<Tarea | null>(null)
  const [aRecordatorio, setARecordatorio] = useState<Tarea | null>(null)
  const [aBorrar, setABorrar] = useState<Tarea | null>(null)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null)
  const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null)

  const invalidarTareas = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['agenda'] }), queryClient.invalidateQueries({ queryKey: ['tareas'] })])

  const accion = useMutation({
    mutationFn: ({ tipo, tarea, fecha, recordatorio }: { tipo: TipoAccion; tarea: Tarea; fecha?: string; recordatorio?: Recordatorio }) =>
      ejecutarAccion(tipo, tarea, fecha, recordatorio),
    onSettled: () => {
      enCurso.current = false
    },
    onSuccess: async ({ tarea: actualizada, recordatorioMovido, fallo }, { tipo, tarea, recordatorio }) => {
      await invalidarTareas()
      if (tipo === 'posponer' || tipo === 'sinFecha') setAPosponer(null)
      // Posponer: el mensaje usa la fecha que calculó el backend.
      const fecha = actualizada.fecha ?? ''
      const conRecordatorio = pendienteDe(recordatorio) !== undefined
      if (tipo === 'posponer') {
        alMensaje(
          recordatorioMovido
            ? mensajeRecordatorioMovido(fecha, recordatorioMovido.fechaHora)
            : fallo !== null
              ? mensajeRecordatorioNoMovido(fecha, fallo)
              : mensajePospuesta(fecha),
        )
      } else {
        alMensaje(tipo === 'sinFecha' && conRecordatorio ? mensajeSinFechaConRecordatorio() : MENSAJES[tipo])
      }
      alTerminar(tarea.id)
      // Se pasó un recordatorio a mover (haya salido bien o no): se refrescan banner, Próximos y la consulta por tarea.
      if (tipo === 'posponer' && conRecordatorio) await queryClient.invalidateQueries({ queryKey: ['recordatorios'] })
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

  const vinculo = useMutation({
    mutationFn: ({ tarea, madre }: { tarea: Tarea; madre: Tarea }) => actualizarTarea(tarea.id, requestConPadre(tarea, madre.id)),
    onSuccess: async (_, { tarea, madre }) => {
      // Primero se cierra y se avisa: la invalidación refresca la lista de candidatas del diálogo.
      setASubtarea(null)
      alMensaje(mensajeMadreCambiada(tarea.titulo, madre.titulo))
      await invalidarTareas()
    },
    onError: (e) => setErrorSubtarea(e.message),
  })

  const borrado = useMutation({
    mutationFn: ({ tarea, eleccion }: { tarea: Tarea; eleccion?: EleccionBorrado }) => borrarTarea(tarea.id, eleccion?.modo),
    onSuccess: async (_, { tarea, eleccion }) => {
      // Primero se cierra y se avisa: si se invalidara antes, el conteo del diálogo caería a 0 mientras sigue abierto.
      setABorrar(null)
      alMensaje(mensajeBorrada(tarea.titulo, eleccion?.subtareas ?? 0, eleccion?.modo))
      alTerminar(tarea.id)
      // `['recordatorios']` siempre: la tarea borrada también pierde el suyo (y con 'borrar', los de sus descendientes).
      await Promise.all([invalidarTareas(), queryClient.invalidateQueries({ queryKey: ['recordatorios'] })])
    },
    onError: (e) => {
      setErrorBorrado(e.message)
      // 409 por subtareas: la lista que tenía el diálogo estaba vieja; se refresca para que ofrezca las dos opciones.
      if (e instanceof ApiError && e.status === 409) void queryClient.invalidateQueries({ queryKey: CLAVE_TODAS_LAS_TAREAS })
    },
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
    ejecutar: (tipo, tarea, fecha, recordatorio) => {
      // Guard síncrono: dos clics antes de que React deshabilite los botones no lanzan dos PATCH/PUT.
      if (enCurso.current) return
      enCurso.current = true
      setError(null)
      accion.mutate({ tipo, tarea, fecha, recordatorio })
    },
    pedirPosponer: (tarea) => {
      setError(null)
      setAPosponer(tarea)
    },
    posponer: aPosponer ? { tarea: aPosponer, cancelar: () => setAPosponer(null) } : null,
    pedirSubtarea: (madre) => {
      setError(null)
      setErrorSubtarea(null)
      setASubtarea(madre)
    },
    subtarea: aSubtarea
      ? {
          madre: aSubtarea,
          error: errorSubtarea,
          pendiente: vinculo.isPending,
          crearNueva: () => {
            setASubtarea(null)
            alSubtarea(aSubtarea)
          },
          vincular: (tarea) => {
            setErrorSubtarea(null)
            vinculo.mutate({ tarea, madre: aSubtarea })
          },
          cancelar: () => setASubtarea(null),
        }
      : null,
    pedirVinculo: (tarea) => setAVincular(tarea),
    vinculo: aVincular ? { tarea: aVincular, cancelar: () => setAVincular(null), alMensaje } : null,
    pedirRecordatorio: (tarea) => setARecordatorio(tarea),
    recordatorioTarea: aRecordatorio ? { tarea: aRecordatorio, cancelar: () => setARecordatorio(null), alMensaje } : null,
    pedirBorrado: (tarea) => {
      setErrorBorrado(null)
      setABorrar(tarea)
    },
    pendiente: accion.isPending || borrado.isPending || vinculo.isPending,
    error,
    confirmarBorrado: aBorrar
      ? {
          tarea: aBorrar,
          error: errorBorrado,
          pendiente: borrado.isPending,
          confirmar: (eleccion) => {
            setErrorBorrado(null)
            borrado.mutate({ tarea: aBorrar, eleccion })
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
