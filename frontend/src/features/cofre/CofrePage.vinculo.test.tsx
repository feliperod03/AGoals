import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { CofrePage } from './CofrePage'
import { tarea } from './fabrica'

vi.mock('@/api/tareas', () => ({ getTareas: vi.fn(), actualizarTarea: vi.fn(), agendarTarea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeTarea: vi.fn(), borrarRecordatorio: vi.fn() }))
import { getObjetivos, quitarTarea as quitarObjetivo } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  localStorage.clear()
  vi.resetAllMocks()
  vi.mocked(getTareas).mockResolvedValue([tarea({ id: 12, titulo: 'Embalar', objetivoId: 3 })])
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 7, nombre: 'Mudanza' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 3, nombre: 'Vivir solo' })])
  vi.mocked(quitarObjetivo).mockResolvedValue(undefined)
})

describe('Cofre: «Proyecto y objetivo…»', () => {
  it('el menú de la fila abre el diálogo y quitar avisa en la región status del Cofre', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CofrePage />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Embalar»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Proyecto y objetivo…' }))
    const d = await screen.findByRole('dialog', { name: 'Proyecto y objetivo de «Embalar»' })
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Quitar objetivo' })).toBeEnabled())
    await user.click(within(d).getByRole('button', { name: 'Quitar objetivo' }))
    await waitFor(() => expect(quitarObjetivo).toHaveBeenCalledWith(3, 12))
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('«Embalar» ya no es del objetivo «Vivir solo»'))).toBe(true),
    )
  })
})
