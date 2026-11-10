import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { CofrePage } from './CofrePage'
import { tarea } from './fabrica'

vi.mock('@/api/tareas', () => ({ getTareas: vi.fn(), actualizarTarea: vi.fn(), agendarTarea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatoriosDeTarea: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { crearRecordatorio, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { getTareas } from '@/api/tareas'

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CofrePage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  localStorage.clear()
  vi.resetAllMocks()
  vi.mocked(getProyectos).mockResolvedValue([])
  vi.mocked(getObjetivos).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
  vi.mocked(crearRecordatorio).mockImplementation(async (req) => ({ id: 1, enviado: false, ...req }))
})

describe('Cofre: «Recordatorio…»', () => {
  it('una tarea sin fecha abre el diálogo desde el menú, arranca mañana a las 09:00 y avisa en la región status del Cofre', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockResolvedValue([tarea({ id: 12, titulo: 'Embalar' })])
    renderizar()
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Embalar»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Recordatorio…' }))
    const d = await screen.findByRole('dialog', { name: 'Recordatorio de «Embalar»' })
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    expect(within(d).getByLabelText('Fecha y hora')).toHaveValue('2026-11-11T09:00')
    await user.click(crear)
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith(expect.objectContaining({ tareaId: 12, fechaHora: '2026-11-11T09:00:00-03:00' })),
    )
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('Recordatorio creado para el mié 11 nov · 09:00'))).toBe(true),
    )
  })
})
