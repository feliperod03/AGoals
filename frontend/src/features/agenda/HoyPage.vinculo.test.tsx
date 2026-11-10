import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tarea } from '@/features/cofre/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Agenda, Tarea } from '@/types/tarea'
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
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn(), getRecordatoriosDeTarea: vi.fn(), borrarRecordatorio: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
import { getEventos } from '@/api/eventos'
import { getObjetivos } from '@/api/objetivos'
import { asignarTarea as asignarProyecto, getProyectos } from '@/api/proyectos'
import { getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, getAgenda, getTareas } from '@/api/tareas'

let servidor: Tarea

function renderizar(inicial: Partial<Tarea> = {}) {
  servidor = tarea({ id: 12, titulo: 'Comprar pan', fecha: '2026-11-10', ...inicial })
  vi.mocked(getAgenda).mockImplementation(async () => ({ fecha: '2026-11-10', conHora: [], sinHora: [servidor] }) satisfies Agenda)
  vi.mocked(getTareas).mockImplementation(async () => [servidor])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
}

async function abrirDesdeMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Acciones de «Comprar pan»' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Proyecto y objetivo…' }))
  return screen.findByRole('dialog', { name: 'Proyecto y objetivo de «Comprar pan»' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 7, nombre: 'Mudanza' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 3, nombre: 'Vivir solo' })])
  vi.mocked(asignarProyecto).mockImplementation(async (id) => {
    servidor = { ...servidor, proyectoId: id }
    return servidor
  })
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({ id: 12 }))
})

describe('Hoy: «Proyecto y objetivo…»', () => {
  it('el menú de acciones abre el diálogo con el vínculo actual', async () => {
    const user = userEvent.setup()
    renderizar({ proyectoId: 7 })
    const d = await abrirDesdeMenu(user)
    await waitFor(() => expect(within(d).getByText('Mudanza')).toBeInTheDocument())
    expect(within(d).getByText('Sin objetivo')).toBeInTheDocument()
  })

  it('asignar desde el menú: avisa en la región status de Hoy y refresca agenda y tareas, no proyectos ni objetivos', async () => {
    const user = userEvent.setup()
    renderizar()
    const d = await abrirDesdeMenu(user)
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Cambiar proyecto' })).toBeEnabled())
    const agenda = vi.mocked(getAgenda).mock.calls.length
    const tareas = vi.mocked(getTareas).mock.calls.length
    const proyectos = vi.mocked(getProyectos).mock.calls.length
    const objetivos = vi.mocked(getObjetivos).mock.calls.length
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    await user.click(within(d).getByRole('button', { name: /^Mudanza/ }))
    await waitFor(() => expect(asignarProyecto).toHaveBeenCalledWith(7, 12))
    await waitFor(() => expect(vi.mocked(getAgenda).mock.calls.length).toBeGreaterThan(agenda))
    await waitFor(() => expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThan(tareas))
    expect(vi.mocked(getProyectos).mock.calls.length).toBe(proyectos)
    expect(vi.mocked(getObjetivos).mock.calls.length).toBe(objetivos)
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('«Comprar pan» ahora es del proyecto «Mudanza»'))).toBe(true),
    )
  })

  it('el botón del diálogo de edición abre el vínculo ENCIMA y la edición queda intacta', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: /^Comprar pan/ }))
    const edicion = await screen.findByRole('dialog', { name: 'Editar tarea' })
    await user.type(within(edicion).getByLabelText('Título'), ' integral')
    await user.click(within(edicion).getByRole('button', { name: 'Proyecto y objetivo…' }))
    const vinculo = await screen.findByRole('dialog', { name: 'Proyecto y objetivo de «Comprar pan»' })
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    await user.click(within(vinculo).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
    expect(screen.getByLabelText('Título')).toHaveValue('Comprar pan integral')
  })

  it('el PUT de edición sigue sin mandar proyectoId ni objetivoId aunque la tarea los tenga', async () => {
    const user = userEvent.setup()
    renderizar({ proyectoId: 7, objetivoId: 3, estado: 'EN_PROGRESO', prioridad: 'ALTA' })
    await user.click(await screen.findByRole('button', { name: /^Comprar pan/ }))
    await user.clear(await screen.findByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Comprar pan y leche')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledTimes(1))
    const [id, request] = vi.mocked(actualizarTarea).mock.calls[0]!
    expect(id).toBe(12)
    expect(Object.keys(request)).not.toContain('proyectoId')
    expect(Object.keys(request)).not.toContain('objetivoId')
  })
})
