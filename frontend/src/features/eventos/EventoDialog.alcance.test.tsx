import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import type { SerieEventoEditada } from '@/types/serie'
import { DialogosEvento } from './DialogosEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
vi.mock('@/api/series', () => ({ crearSerie: vi.fn(), borrarSerieDesde: vi.fn(), editarSerieDesde: vi.fn() }))
import { actualizarEvento } from '@/api/eventos'
import { getRecordatoriosDeEvento } from '@/api/recordatorios'
import { editarSerieDesde } from '@/api/series'

// Hoy es lunes 16 de noviembre de 2026 a las 10:00. El evento abierto es el de hoy de 07:00 a 08:00 (id 9, serie 5).
const AHORA = '2026-11-16T10:00:00-03:00'
const alMensaje = vi.fn()

function evento(parcial: Partial<Evento> = {}): Evento {
  return {
    id: 9,
    titulo: 'Gimnasio',
    descripcion: '',
    fechaHoraInicio: '2026-11-16T07:00:00-03:00',
    fechaHoraFin: '2026-11-16T08:00:00-03:00',
    prioridad: null,
    serieId: 5,
    ...parcial,
  }
}

function recordatorio(fechaHora: string, enviado = false): Recordatorio {
  return { id: 3, tareaId: null, eventoId: 9, fechaHora, canal: 'APP', enviado, descripcion: null }
}

function editada(parcial: Partial<SerieEventoEditada> = {}): SerieEventoEditada {
  return {
    eventos: [
      evento({ titulo: 'Gimnasio (nuevo)' }),
      evento({ id: 10, titulo: 'Gimnasio (nuevo)', fechaHoraInicio: '2026-11-23T07:00:00-03:00', fechaHoraFin: '2026-11-23T08:00:00-03:00' }),
    ],
    recordatoriosOmitidos: 0,
    ...parcial,
  }
}

function Pagina({ abrir }: { abrir: Evento }) {
  const acciones = useAccionesEvento({ alMensaje })
  const boton = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" ref={boton} onClick={() => acciones.abrirEditar(abrir)}>
        Abrir
      </button>
      <DialogosEvento acciones={acciones} focoAlternativo={boton} />
    </>
  )
}

async function montar(abierto: Evento = evento()) {
  const user = userEvent.setup({ advanceTimers: () => undefined })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <Pagina abrir={abierto} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return { user, invalidar }
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement
const radio = (nombre: string) => screen.getByRole('radio', { name: nombre })
const dialogo = () => screen.queryByRole('dialog')
const casilla = () => screen.getByRole('checkbox', { name: 'Avisarme antes de cada evento' })

function pendiente<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => {
    resolver = r
  })
  return { promesa, resolver }
}

/** Abre la edición y elige «Este y los siguientes». */
async function enSiguientes(abierto: Evento = evento()) {
  const montado = await montar(abierto)
  await montado.user.click(radio('Este y los siguientes'))
  return montado
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(AHORA))
  vi.resetAllMocks()
  vi.mocked(actualizarEvento).mockImplementation(async (id, r) => ({ id, serieId: 5, ...r }))
  vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([])
  vi.mocked(editarSerieDesde).mockResolvedValue(editada())
})
afterEach(() => vi.useRealTimers())

describe('EventoDialog: selector de alcance', () => {
  it('solo aparece en un evento de serie; en uno suelto no hay selector', async () => {
    await montar(evento({ serieId: null }))
    expect(screen.queryByRole('group', { name: '¿Qué eventos se editan?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('en un evento de serie, «Solo este evento» viene elegido y los campos de día se ven', async () => {
    await montar()
    expect(screen.getByRole('group', { name: '¿Qué eventos se editan?' })).toBeInTheDocument()
    expect(radio('Solo este evento')).toBeChecked()
    expect(campo('Día de inicio').value).toBe('2026-11-16')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('regresión: editar solo este evento hace el PUT normal y no llama al de la serie', async () => {
    const { user } = await montar()
    await user.type(campo('Título'), ' (tarde)')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledWith(9, expect.objectContaining({ titulo: 'Gimnasio (tarde)' }))
    expect(editarSerieDesde).not.toHaveBeenCalled()
  })

  it('con «Este y los siguientes» se ocultan los días y queda la hora de inicio y la de fin', async () => {
    await enSiguientes()
    expect(radio('Este y los siguientes')).toBeChecked()
    expect(screen.queryByLabelText('Día de inicio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Día de fin')).not.toBeInTheDocument()
    expect(campo('Hora de inicio').value).toBe('07:00')
    expect(campo('Hora de fin').value).toBe('08:00')
    expect(screen.getByRole('checkbox', { name: 'Todo el día' })).toBeDisabled()
    expect(screen.getByText('Para marcar «Todo el día», elige «Solo este evento».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeInTheDocument()
  })

  it('«Termina al día siguiente» cuando la hora de fin es anterior a la de inicio', async () => {
    await enSiguientes()
    expect(screen.queryByText('Termina al día siguiente.')).not.toBeInTheDocument()
    fireEvent.change(campo('Hora de inicio'), { target: { value: '22:00' } })
    fireEvent.change(campo('Hora de fin'), { target: { value: '01:00' } })
    expect(screen.getByText('Termina al día siguiente.')).toBeInTheDocument()
  })

  it('cambiar de alcance no pierde lo escrito y los días de «este» se restauran al volver', async () => {
    const { user } = await montar()
    await user.type(campo('Título'), ' (nuevo)')
    // Un día elegido a mano antes de cambiar de alcance (el fin lo acompaña, conservando la duración).
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-11-18' } })
    expect(campo('Día de fin').value).toBe('2026-11-18')

    await user.click(radio('Este y los siguientes'))
    expect(campo('Título').value).toBe('Gimnasio (nuevo)')
    await user.click(radio('Solo este evento'))
    expect(campo('Título').value).toBe('Gimnasio (nuevo)')
    expect(campo('Día de inicio').value).toBe('2026-11-18')
    expect(campo('Día de fin').value).toBe('2026-11-18')
  })

  it('si en «siguientes» el fin queda antes del inicio, al volver a «este» termina al día siguiente', async () => {
    const { user } = await enSiguientes()
    fireEvent.change(campo('Hora de fin'), { target: { value: '06:00' } })
    await user.click(radio('Solo este evento'))
    expect(campo('Hora de fin').value).toBe('06:00')
    expect(campo('Día de inicio').value).toBe('2026-11-16')
    expect(campo('Día de fin').value).toBe('2026-11-17')
  })
})

describe('EventoDialog: regla P6 (24 h o más)', () => {
  it('un evento de 24 h justas deshabilita «Este y los siguientes» con su motivo siempre visible', async () => {
    await montar(evento({ fechaHoraInicio: '2026-11-16T10:00:00-03:00', fechaHoraFin: '2026-11-17T10:00:00-03:00' }))
    expect(radio('Este y los siguientes')).toBeDisabled()
    expect(radio('Solo este evento')).toBeChecked()
    const motivo = screen.getByText(/Este evento dura 24 horas o más/)
    expect(motivo).toBeVisible()
    expect(radio('Este y los siguientes')).toHaveAccessibleDescription(motivo.textContent ?? '')
  })

  it('un evento de varios días con horas también', async () => {
    await montar(evento({ fechaHoraInicio: '2026-11-16T10:00:00-03:00', fechaHoraFin: '2026-11-19T09:00:00-03:00' }))
    expect(radio('Este y los siguientes')).toBeDisabled()
    expect(screen.getByText(/dura 24 horas o más/)).toBeVisible()
  })

  it('un evento de todo el día, con su propio motivo', async () => {
    await montar(evento({ fechaHoraInicio: '2026-11-16T00:00:00-03:00', fechaHoraFin: '2026-11-17T00:00:00-03:00' }))
    expect(radio('Este y los siguientes')).toBeDisabled()
    expect(screen.getByText(/Este evento es de todo el día/)).toBeVisible()
  })

  it('un evento que cruza la medianoche pero dura menos de 24 h sí se puede editar con los siguientes', async () => {
    await montar(evento({ fechaHoraInicio: '2026-11-16T22:00:00-03:00', fechaHoraFin: '2026-11-17T01:00:00-03:00' }))
    expect(radio('Este y los siguientes')).toBeEnabled()
    expect(screen.queryByText(/dura 24 horas o más/)).not.toBeInTheDocument()
  })

  it('marcar «Todo el día» en el formulario también lo deshabilita, y desmarcarlo lo libera', async () => {
    const { user } = await montar()
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(radio('Este y los siguientes')).toBeDisabled()
    expect(screen.getByText('Para editar los siguientes, desmarca «Todo el día».')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(radio('Este y los siguientes')).toBeEnabled()
  })
})

describe('EventoDialog: recordatorio de «Este y los siguientes»', () => {
  it('precarga la distancia entre el inicio de este evento y su recordatorio pendiente', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-16T06:30:00-03:00')])
    await enSiguientes()
    await waitFor(() => expect(casilla()).toBeChecked())
    expect(campo('Minutos antes del evento').value).toBe('30')
    expect(screen.queryByText(/ya se envió/)).not.toBeInTheDocument()
  })

  it('sin recordatorio: la casilla queda desmarcada y avisa que guardar quita los pendientes de los siguientes', async () => {
    await enSiguientes()
    await waitFor(() => expect(screen.queryByText('Comprobando el recordatorio de este evento…')).not.toBeInTheDocument())
    expect(casilla()).not.toBeChecked()
    expect(screen.getByText('Al guardar se quitan los recordatorios pendientes de este evento y los siguientes.')).toBeInTheDocument()
  })

  it('si la distancia no cabe en 0..10080 se propone 60 y se explica', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-01T07:00:00-03:00')])
    await enSiguientes()
    await waitFor(() => expect(casilla()).toBeChecked())
    expect(campo('Minutos antes del evento').value).toBe('60')
    expect(screen.getByText(/no cabe en 0–10080 minutos antes: se propone 60/)).toBeInTheDocument()
  })

  it('un recordatorio ya enviado sirve de modelo y la nota dice que ese no cambia', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-16T06:00:00-03:00', true)])
    await enSiguientes()
    await waitFor(() => expect(casilla()).toBeChecked())
    expect(campo('Minutos antes del evento').value).toBe('60')
    expect(screen.getByText(/ya se envió y no cambia/)).toBeInTheDocument()
  })

  it('mientras se consulta, «Guardar todos» espera y la casilla no se puede tocar', async () => {
    const consulta = pendiente<Recordatorio[]>()
    vi.mocked(getRecordatoriosDeEvento).mockReturnValue(consulta.promesa)
    await enSiguientes()
    expect(screen.getByText('Comprobando el recordatorio de este evento…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeDisabled()
    expect(casilla()).toBeDisabled()
    consulta.resolver([])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
  })

  it('si la consulta falla no se escribe a ciegas: espera hasta reintentar o hasta que el usuario decida', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValue(new Error('sin red'))
    const { user } = await enSiguientes()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeDisabled()
    await user.click(casilla())
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled()
  })

  it('«Reintentar» trae el recordatorio y deja guardar', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValueOnce(new Error('sin red'))
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-16T06:45:00-03:00')])
    const { user } = await enSiguientes()
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(casilla()).toBeChecked())
    expect(campo('Minutos antes del evento').value).toBe('15')
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled()
  })

  it('se oculta la casilla de mover el recordatorio con el inicio (9e) y el botón «Recordatorio…»', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-16T06:30:00-03:00')])
    const { user } = await montar()
    // En «solo este», cambiar el inicio ofrece mover el recordatorio.
    await screen.findByRole('button', { name: /^Recordatorio: / })
    fireEvent.change(campo('Hora de inicio'), { target: { value: '09:00' } })
    expect(await screen.findByText(/Mover también el recordatorio/)).toBeInTheDocument()

    await user.click(radio('Este y los siguientes'))
    expect(screen.queryByText(/Mover también el recordatorio/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Recordatorio/ })).not.toBeInTheDocument()
    expect(casilla()).toBeInTheDocument()

    await user.click(radio('Solo este evento'))
    expect(await screen.findByText(/Mover también el recordatorio/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Recordatorio: / })).toBeInTheDocument()
  })
})

describe('EventoDialog: guardar «Este y los siguientes»', () => {
  it('manda el cuerpo del PUT de la serie (sin recordatorio = null), refresca eventos y recordatorios, cierra y avisa', async () => {
    const { user, invalidar } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.type(campo('Título'), ' (nuevo)')
    fireEvent.change(campo('Hora de inicio'), { target: { value: '08:00' } })
    fireEvent.change(campo('Hora de fin'), { target: { value: '09:30' } })
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))

    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(editarSerieDesde).toHaveBeenCalledTimes(1)
    expect(editarSerieDesde).toHaveBeenCalledWith(9, {
      titulo: 'Gimnasio (nuevo)',
      descripcion: '',
      prioridad: null,
      horaInicio: '08:00',
      horaFin: '09:30',
      ahora: expect.stringMatching(/^2026-11-16T10:00:00/),
      recordatorio: null,
    })
    expect(actualizarEvento).not.toHaveBeenCalled()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['eventos'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
    expect(alMensaje).toHaveBeenCalledWith('Serie «Gimnasio (nuevo)» actualizada: 2 eventos, del lun 16 nov al lun 23 nov, sin recordatorio', { persistente: false })
  })

  it('con recordatorio manda los minutos y los dice en el aviso', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([recordatorio('2026-11-16T06:30:00-03:00')])
    const { user } = await enSiguientes()
    await waitFor(() => expect(casilla()).toBeChecked())
    fireEvent.change(campo('Minutos antes del evento'), { target: { value: '45' } })
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(editarSerieDesde).toHaveBeenCalledWith(9, expect.objectContaining({ recordatorio: { minutosAntes: 45 } }))
    expect(alMensaje).toHaveBeenCalledWith(expect.stringContaining('con recordatorio 45 min antes'), { persistente: false })
  })

  it('con recordatorios omitidos el aviso es persistente y dice que quedaron como estaban', async () => {
    vi.mocked(editarSerieDesde).mockResolvedValue(editada({ recordatoriosOmitidos: 2 }))
    const { user } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(alMensaje).toHaveBeenCalledWith(expect.stringMatching(/2 recordatorios quedaron como estaban porque su nueva hora ya había pasado/), { persistente: true })
  })

  it('valida antes de llamar: minutos fuera de rango y horas iguales no llegan al servidor', async () => {
    const { user } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.click(casilla())
    fireEvent.change(campo('Minutos antes del evento'), { target: { value: '20000' } })
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    expect(await screen.findByText('Indica entre 0 y 10080 minutos')).toBeInTheDocument()

    fireEvent.change(campo('Minutos antes del evento'), { target: { value: '30' } })
    fireEvent.change(campo('Hora de fin'), { target: { value: '07:00' } })
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    expect(await screen.findByText('La hora de fin debe ser distinta de la de inicio')).toBeInTheDocument()
    expect(editarSerieDesde).not.toHaveBeenCalled()
    expect(dialogo()).toBeInTheDocument()
  })

  it('un 400 del servidor se muestra tal cual y el diálogo sigue abierto con lo escrito', async () => {
    vi.mocked(editarSerieDesde).mockRejectedValue(new ApiError(400, 'Mensaje del servidor'))
    const { user } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.type(campo('Título'), ' (nuevo)')
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    expect(await within(screen.getByRole('dialog')).findByText('Mensaje del servidor')).toBeInTheDocument()
    expect(campo('Título').value).toBe('Gimnasio (nuevo)')
    expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled()
    expect(alMensaje).not.toHaveBeenCalled()
  })

  it('doble clic = una sola llamada; mientras guarda todo queda deshabilitado', async () => {
    const respuesta = pendiente<SerieEventoEditada>()
    vi.mocked(editarSerieDesde).mockReturnValue(respuesta.promesa)
    const { user } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.dblClick(screen.getByRole('button', { name: 'Guardar todos' }))
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(radio('Solo este evento')).toBeDisabled()
    respuesta.resolver(editada())
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(editarSerieDesde).toHaveBeenCalledTimes(1)
  })
})

describe('EventoDialog: 404 y 409 al guardar «Este y los siguientes»', () => {
  it('404: el evento ya no existía; refresca eventos y recordatorios, cierra y lo dice', async () => {
    vi.mocked(editarSerieDesde).mockRejectedValue(new ApiError(404, 'Evento 9 no encontrado'))
    const { user, invalidar } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(alMensaje).toHaveBeenCalledWith('El evento «Gimnasio» ya no existía')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['eventos'] })
    expect(invalidar).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['recordatorios'] }))
  })

  it('409: el evento ya no es de una serie; el diálogo sigue abierto, sin selector, con los días a la vista y un aviso', async () => {
    vi.mocked(editarSerieDesde).mockRejectedValue(new ApiError(409, 'El evento 9 no pertenece a una serie: usa la edición normal'))
    const { user, invalidar } = await enSiguientes()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar todos' })).toBeEnabled())
    await user.type(campo('Título'), ' (nuevo)')
    await user.click(screen.getByRole('button', { name: 'Guardar todos' }))

    expect(await screen.findByText(/ya no forma parte de una serie/)).toBeInTheDocument()
    expect(dialogo()).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(campo('Día de inicio').value).toBe('2026-11-16')
    expect(campo('Título').value).toBe('Gimnasio (nuevo)')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['eventos'] })
    expect(alMensaje).not.toHaveBeenCalled()
    // No escribe a ciegas: no hubo PUT normal por su cuenta.
    expect(actualizarEvento).not.toHaveBeenCalled()
    expect(editarSerieDesde).toHaveBeenCalledTimes(1)

    // El siguiente «Guardar» ya es el PUT de un evento suelto.
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledWith(9, expect.objectContaining({ titulo: 'Gimnasio (nuevo)' }))
    expect(editarSerieDesde).toHaveBeenCalledTimes(1)
  })
})
