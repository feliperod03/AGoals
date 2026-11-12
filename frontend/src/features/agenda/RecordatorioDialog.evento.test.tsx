import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import { RecordatorioDialog } from './RecordatorioDialog'

vi.mock('@/api/recordatorios', () => ({
  getRecordatoriosDeEvento: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { actualizarRecordatorio, borrarRecordatorio, crearRecordatorio, getRecordatoriosDeEvento } from '@/api/recordatorios'

// Recordatorio de un EVENTO (9d). Los casos compartidos con la tarea (estados, bloqueo, guard) se prueban en
// RecordatorioDialog.test.tsx; aquí van los que dependen de que el destino sea un evento.

const EVENTO: Evento = {
  id: 9,
  titulo: 'Dentista',
  descripcion: null,
  fechaHoraInicio: '2026-11-12T15:00:00-03:00',
  fechaHoraFin: '2026-11-12T16:00:00-03:00',
  prioridad: null,
}
const TODO_EL_DIA: Evento = { ...EVENTO, fechaHoraInicio: '2026-11-13T00:00:00-03:00', fechaHoraFin: '2026-11-14T00:00:00-03:00' }

function recordatorio(parcial: Partial<Recordatorio> = {}): Recordatorio {
  return { id: 50, tareaId: null, eventoId: 9, fechaHora: '2026-11-12T14:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Aviso', ...parcial }
}

/** Lo que "tiene" el servidor: los mocks de escritura lo modifican, así el refresco muestra lo nuevo. */
let servidor: Recordatorio[]

function renderizar(evento: Evento = EVENTO, existentes: Recordatorio[] = [], alCerrarFoco?: (e: Event) => void) {
  servidor = existentes
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const alMensaje = vi.fn()
  const alCerrar = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <RecordatorioDialog destino={{ tipo: 'evento', evento }} alCerrar={alCerrar} alMensaje={alMensaje} alCerrarFoco={alCerrarFoco} />
    </QueryClientProvider>,
  )
  return { alMensaje, alCerrar }
}

const dialogo = () => screen.findByRole('dialog', { name: 'Recordatorio de «Dentista»' })
const campoFecha = () => screen.getByLabelText('Fecha y hora')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getRecordatoriosDeEvento).mockImplementation(async (id) => servidor.filter((r) => r.eventoId === id))
  vi.mocked(crearRecordatorio).mockImplementation(async (req) => {
    const nuevo = recordatorio({ id: 77, ...req })
    servidor = [...servidor, nuevo]
    return nuevo
  })
  vi.mocked(actualizarRecordatorio).mockImplementation(async (id, req) => {
    const nuevo = recordatorio({ id, ...req })
    servidor = servidor.map((r) => (r.id === id ? nuevo : r))
    return nuevo
  })
  vi.mocked(borrarRecordatorio).mockImplementation(async (id) => {
    servidor = servidor.filter((r) => r.id !== id)
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Recordatorio de un evento', () => {
  it('crea uno: arranca 60 min antes del inicio, muestra cuándo empieza y manda eventoId con tareaId null', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar()
    const d = await dialogo()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    expect(within(d).getByText('El evento empieza el jue 12 nov · 15:00')).toBeInTheDocument()
    expect(campoFecha()).toHaveValue('2026-11-12T14:00')
    await user.click(crear)
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith({
        tareaId: null,
        eventoId: 9,
        fechaHora: '2026-11-12T14:00:00-03:00',
        canal: 'APP',
        descripcion: '',
      }),
    )
    await waitFor(() => expect(within(d).getByRole('status')).toHaveTextContent('Recordatorio creado para el jue 12 nov · 14:00'))
    expect(alMensaje).toHaveBeenCalledWith('Recordatorio creado para el jue 12 nov · 14:00')
    // Cada cambio es una llamada inmediata: el diálogo sigue abierto y pasa a editar.
    expect(await within(d).findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('un evento de día completo arranca su primer día a las 09:00 y lo dice como lapso', async () => {
    renderizar(TODO_EL_DIA)
    const d = await dialogo()
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeEnabled())
    expect(campoFecha()).toHaveValue('2026-11-13T09:00')
    expect(within(d).getByText('El evento es vie 13 nov, todo el día')).toBeInTheDocument()
  })

  it('con recordatorio abre en edición y el PUT reenvía los cinco campos con eventoId', async () => {
    const user = userEvent.setup()
    renderizar(EVENTO, [recordatorio({ descripcion: 'Llevar estudios' })])
    const d = await dialogo()
    await within(d).findByRole('button', { name: 'Guardar cambios' })
    await waitFor(() => expect(campoFecha()).toBeEnabled())
    expect(within(d).getByText('Este evento ya tiene un recordatorio. Cada cambio se aplica al momento.')).toBeInTheDocument()
    expect(campoFecha()).toHaveValue('2026-11-12T14:00')
    fireEvent.change(campoFecha(), { target: { value: '2026-11-12T13:30' } })
    await user.click(within(d).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(actualizarRecordatorio).toHaveBeenCalledWith(50, {
        tareaId: null,
        eventoId: 9,
        fechaHora: '2026-11-12T13:30:00-03:00',
        canal: 'APP',
        descripcion: 'Llevar estudios',
      }),
    )
    expect(crearRecordatorio).not.toHaveBeenCalled()
  })

  it('«Quitar» borra sin confirmar y vuelve a ofrecer crear', async () => {
    const user = userEvent.setup()
    renderizar(EVENTO, [recordatorio()])
    const d = await dialogo()
    const quitar = await within(d).findByRole('button', { name: 'Quitar el recordatorio de «Dentista»' })
    await waitFor(() => expect(quitar).toBeEnabled())
    await user.click(quitar)
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(50))
    expect(await within(d).findByRole('button', { name: 'Crear recordatorio' })).toBeInTheDocument()
  })

  it('un doble clic en «Crear» manda una sola llamada', async () => {
    const user = userEvent.setup()
    renderizar()
    const d = await dialogo()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    await user.dblClick(crear)
    await waitFor(() => expect(crearRecordatorio).toHaveBeenCalled())
    expect(crearRecordatorio).toHaveBeenCalledTimes(1)
  })

  it('409 al crear: muestra el mensaje del servidor y pasa a editar el que ya existía', async () => {
    const user = userEvent.setup()
    renderizar()
    const d = await dialogo()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    vi.mocked(crearRecordatorio).mockImplementation(async () => {
      servidor = [recordatorio({ id: 60, descripcion: 'De otra pestaña' })]
      throw new ApiError(409, 'El evento 9 ya tiene un recordatorio')
    })
    await user.click(crear)
    expect(await within(d).findByRole('alert')).toHaveTextContent('El evento 9 ya tiene un recordatorio')
    expect(await within(d).findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('De otra pestaña')
  })

  it('404 al guardar: muestra el mensaje, refresca y vuelve a ofrecer crear', async () => {
    const user = userEvent.setup()
    renderizar(EVENTO, [recordatorio()])
    const d = await dialogo()
    const guardar = await within(d).findByRole('button', { name: 'Guardar cambios' })
    await waitFor(() => expect(guardar).toBeEnabled())
    vi.mocked(actualizarRecordatorio).mockImplementation(async () => {
      servidor = []
      throw new ApiError(404, 'Recordatorio 50 no encontrado')
    })
    await user.click(guardar)
    expect(await within(d).findByRole('alert')).toHaveTextContent('Recordatorio 50 no encontrado')
    expect(await within(d).findByRole('button', { name: 'Crear recordatorio' })).toBeInTheDocument()
  })

  it('si la consulta falla, no se escribe a ciegas; «Reintentar» recupera el formulario', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValueOnce(new ApiError(500, 'Error interno del servidor'))
    renderizar()
    const d = await dialogo()
    expect(await within(d).findByText('No se pudo consultar el recordatorio de este evento.')).toBeInTheDocument()
    expect(campoFecha()).toBeDisabled()
    expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeDisabled()
    expect(crearRecordatorio).not.toHaveBeenCalled()
    await user.click(within(d).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(campoFecha()).toBeEnabled())
  })

  it('si el aviso por defecto ya pasó, lo dice sin bloquear', async () => {
    vi.setSystemTime(new Date('2026-11-12T14:30:00-03:00'))
    renderizar()
    const d = await dialogo()
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeEnabled())
    expect(within(d).getByText('Esa hora ya pasó: el aviso saldrá enseguida.')).toBeInTheDocument()
  })

  it('«Listo» cierra el diálogo', async () => {
    const user = userEvent.setup()
    const { alCerrar } = renderizar()
    const d = await dialogo()
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeEnabled())
    await user.click(within(d).getByRole('button', { name: 'Listo' }))
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })
})
