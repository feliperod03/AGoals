import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tarea } from '@/features/cofre/fabrica'
import type { Recordatorio } from '@/types/recordatorio'
import type { Agenda } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({
  getAgenda: vi.fn(),
  getTarea: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  getTareas: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
}))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatorios: vi.fn(),
  getRecordatoriosDeTarea: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { getEventos } from '@/api/eventos'
import { actualizarRecordatorio, borrarRecordatorio, crearRecordatorio, getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, getAgenda, getTareas } from '@/api/tareas'

function recordatorio(parcial: Partial<Recordatorio> = {}): Recordatorio {
  return { id: 50, tareaId: null, eventoId: null, fechaHora: '2026-11-11T09:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Aviso', ...parcial }
}

/** Lo que "tiene" el servidor: los mocks de escritura lo modifican, así el refresco muestra lo nuevo. */
let todos: Recordatorio[]

function renderizar(existentes: Recordatorio[] = []) {
  todos = existentes
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [tarea({ id: 12, titulo: 'Comprar pan', fecha: '2026-11-10' })] }
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  vi.mocked(getTareas).mockResolvedValue(agenda.sinHora)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockImplementation(async () => todos)
  vi.mocked(getRecordatoriosDeTarea).mockImplementation(async (id) => todos.filter((r) => r.tareaId === id))
  vi.mocked(crearRecordatorio).mockImplementation(async (req) => {
    const nuevo = recordatorio({ id: 99, ...req })
    todos = [...todos, nuevo]
    return nuevo
  })
  vi.mocked(actualizarRecordatorio).mockImplementation(async (id, req) => {
    const nuevo = recordatorio({ id, ...req })
    todos = todos.map((r) => (r.id === id ? nuevo : r))
    return nuevo
  })
  vi.mocked(borrarRecordatorio).mockImplementation(async (id) => {
    todos = todos.filter((r) => r.id !== id)
  })
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({ id: 12 }))
})

describe('Hoy: «Recordatorio…»', () => {
  it('el menú de la fila abre el diálogo de la tarea y crear avisa en la región status de Hoy', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Comprar pan»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Recordatorio…' }))
    const d = await screen.findByRole('dialog', { name: 'Recordatorio de «Comprar pan»' })
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    await user.click(crear)
    await waitFor(() => expect(crearRecordatorio).toHaveBeenCalledWith(expect.objectContaining({ tareaId: 12, canal: 'APP' })))
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('Recordatorio creado para el mar 10 nov · 09:00'))).toBe(true),
    )
  })

  it('el botón del diálogo de edición abre el recordatorio ENCIMA y la edición queda intacta', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: /^Comprar pan/ }))
    const edicion = await screen.findByRole('dialog', { name: 'Editar tarea' })
    await user.type(within(edicion).getByLabelText('Título'), ' integral')
    await user.click(within(edicion).getByRole('button', { name: 'Recordatorio…' }))
    const rec = await screen.findByRole('dialog', { name: 'Recordatorio de «Comprar pan»' })
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    await user.click(within(rec).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
    expect(screen.getByLabelText('Título')).toHaveValue('Comprar pan integral')
    // El formulario de la tarea no guarda el recordatorio.
    expect(actualizarTarea).not.toHaveBeenCalled()
    expect(crearRecordatorio).not.toHaveBeenCalled()
  })
})

describe('Hoy: tarjeta «Próximos recordatorios»', () => {
  it('«Nuevo recordatorio» crea uno suelto, aparece en la tarjeta y cierra el diálogo', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Nuevo recordatorio' }))
    const d = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
    await user.type(within(d).getByLabelText('Descripción (obligatoria)'), 'Pagar la luz')
    await user.click(within(d).getByRole('button', { name: 'Crear recordatorio' }))
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith(expect.objectContaining({ tareaId: null, eventoId: null, descripcion: 'Pagar la luz' })),
    )
    expect(await screen.findByText('Pagar la luz')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('«Editar» en una fila de tarea conserva su tareaId en el PUT', async () => {
    const user = userEvent.setup()
    renderizar([recordatorio({ id: 7, tareaId: 12, descripcion: 'Llevar bolsa' })])
    await user.click(await screen.findByRole('button', { name: 'Editar recordatorio: Llevar bolsa' }))
    const d = await screen.findByRole('dialog', { name: 'Editar recordatorio' })
    await user.click(within(d).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(actualizarRecordatorio).toHaveBeenCalledWith(7, expect.objectContaining({ tareaId: 12, eventoId: null, descripcion: 'Llevar bolsa' })),
    )
  })

  it('borrar una fila pide confirmación y la quita de la tarjeta', async () => {
    const user = userEvent.setup()
    renderizar([recordatorio({ id: 7, descripcion: 'Llamar a Ana' })])
    await user.click(await screen.findByRole('button', { name: 'Editar recordatorio: Llamar a Ana' }))
    await user.click(await screen.findByRole('button', { name: 'Borrar este recordatorio' }))
    expect(borrarRecordatorio).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Borrar recordatorio' }))
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(7))
    await waitFor(() => expect(screen.queryByText('Llamar a Ana')).not.toBeInTheDocument())
  })
})
