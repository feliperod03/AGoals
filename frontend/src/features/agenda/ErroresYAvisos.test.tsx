import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Recordatorio } from '@/types/recordatorio'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

// Pulido 2b: errores con dueño (selector vs lista), descartar y aviso persistente en fallos parciales.

vi.mock('@/api/tareas', () => ({
  getAgenda: vi.fn(),
  getTarea: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
  getTareas: vi.fn(),
}))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatorios: vi.fn(),
  getRecordatoriosDeTarea: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { getEventos } from '@/api/eventos'
import { actualizarRecordatorio, getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { getAgenda, getTareas, posponerTarea, reabrirTarea } from '@/api/tareas'

function tarea(parcial: Partial<Tarea> = {}): Tarea {
  return {
    id: 7,
    titulo: 'Informe',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    fecha: '2026-11-10',
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

const recordatorio = (parcial: Partial<Recordatorio> = {}): Recordatorio => ({
  id: 50,
  tareaId: 7,
  eventoId: null,
  fechaHora: '2026-11-10T15:00:00-03:00',
  canal: 'APP',
  enviado: false,
  descripcion: 'Aviso',
  ...parcial,
})

function renderizar(t: Tarea = tarea()) {
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [t] }
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HoyPage />
    </QueryClientProvider>,
  )
}

type Usuario = ReturnType<typeof userEvent.setup>

async function abrirSelector(user: Usuario) {
  await user.click(await screen.findByRole('button', { name: 'Acciones de «Informe»' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Posponer' }))
  const selector = await screen.findByRole('dialog', { name: 'Posponer tarea' })
  await waitFor(() => expect(within(selector).getByRole('button', { name: 'Dejar sin fecha' })).toBeEnabled())
  return selector
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
  vi.mocked(getTareas).mockResolvedValue([])
})

describe('Errores con dueño', () => {
  it('un error al posponer se ve solo en el selector, no en la lista, y cancelar lo limpia', async () => {
    const user = userEvent.setup()
    vi.mocked(posponerTarea).mockRejectedValue(new ApiError(409, 'No se puede posponer ahora'))
    renderizar()
    const selector = await abrirSelector(user)

    await user.click(within(selector).getByRole('button', { name: /^Mañana/ }))

    expect(await within(selector).findByText('No se puede posponer ahora')).toBeInTheDocument()
    expect(screen.getAllByText('No se puede posponer ahora')).toHaveLength(1)

    await user.click(within(selector).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('No se puede posponer ahora')).not.toBeInTheDocument()

    const otra = await abrirSelector(user)
    expect(within(otra).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un error de «Reabrir» se ve en la lista, se descarta con «×» y no sale en el selector', async () => {
    const user = userEvent.setup()
    vi.mocked(reabrirTarea).mockRejectedValue(new ApiError(404, 'La tarea ya no existe'))
    renderizar(tarea({ estado: 'HECHO' }))

    await user.click(await screen.findByRole('button', { name: 'Reabrir «Informe»' }))
    expect(await screen.findByText('La tarea ya no existe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Descartar error' }))
    expect(screen.queryByText('La tarea ya no existe')).not.toBeInTheDocument()
  })
})

describe('Fallo parcial al posponer', () => {
  it('la tarea se pospone y el aviso es persistente con el motivo del servidor', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio()])
    vi.mocked(posponerTarea).mockImplementation(async (_id, fecha) => tarea({ fecha }))
    vi.mocked(actualizarRecordatorio).mockRejectedValue(new ApiError(404, 'Recordatorio no encontrado'))
    renderizar()
    const selector = await abrirSelector(user)

    await user.click(within(selector).getByRole('button', { name: /^Mañana/ }))

    const estado = await screen.findByRole('status')
    await waitFor(() => expect(estado).toHaveTextContent(/no se pudo mover el recordatorio \(Recordatorio no encontrado\)/))
    expect(estado.parentElement).toHaveAttribute('data-persistente', 'true')
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument()
  })

  it('un posponer completo NO es persistente', async () => {
    const user = userEvent.setup()
    vi.mocked(posponerTarea).mockImplementation(async (_id, fecha) => tarea({ fecha }))
    renderizar()
    const selector = await abrirSelector(user)
    await user.click(within(selector).getByRole('button', { name: /^Mañana/ }))
    const estado = await screen.findByRole('status')
    await waitFor(() => expect(estado).toHaveTextContent('Pospuesta al 11 de noviembre'))
    expect(estado.parentElement).not.toHaveAttribute('data-persistente')
  })
})

describe('Textos que explican el porqué (posponer)', () => {
  it('recordatorio ya enviado: sin casilla y con la explicación', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ enviado: true })])
    renderizar()
    const selector = await abrirSelector(user)
    expect(within(selector).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(selector).getByText(/ya se envió \(el .*\), así que no se mueve/)).toBeInTheDocument()
  })

  it('sin destino calculable la ayuda de la casilla no queda vacía', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ fechaHora: '2026-11-11T15:00:00-03:00' })])
    renderizar(tarea({ fecha: '2026-11-11' }))
    const selector = await abrirSelector(user)
    const casilla = within(selector).getByRole('checkbox', { name: /Mover también el recordatorio/ })
    const ayuda = document.getElementById(casilla.getAttribute('aria-describedby')!)!
    expect(ayuda).toHaveTextContent('Elige una fecha para ver dónde quedará el recordatorio.')
  })
})
