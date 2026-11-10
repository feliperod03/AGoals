import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { idea } from '@/features/ideas/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { ObjetivoPage } from './ObjetivoPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn() }))
import { getIdeas } from '@/api/ideas'
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

function renderizar(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/objetivos/:id" element={<ObjetivoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 1, nombre: 'Salud' }), objetivo({ id: 2, nombre: 'Correr', padreId: 1 }), objetivo({ id: 3, nombre: 'Viajar' })])
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 1, nombre: 'Plan', objetivoId: 1 })])
  vi.mocked(getTareas).mockResolvedValue([])
})
afterEach(() => vi.resetAllMocks())

const seccion = async () => (await screen.findByRole('heading', { name: 'Ideas ligadas', level: 2 })).closest('section')!

describe('ObjetivoPage: Ideas ligadas', () => {
  it('muestra las ideas de ese objetivo y no las de otro, las del subobjetivo, las de sus proyectos ni las de un proyecto con el mismo id', async () => {
    vi.mocked(getIdeas).mockResolvedValue([
      idea({ id: 1, titulo: 'Hacer chequeo', objetivoId: 1 }),
      idea({ id: 2, titulo: 'De otro objetivo', objetivoId: 3 }),
      idea({ id: 3, titulo: 'Del subobjetivo', objetivoId: 2 }),
      idea({ id: 4, titulo: 'De su proyecto', proyectoId: 1 }),
      idea({ id: 5, titulo: 'Suelta' }),
    ])
    renderizar('/objetivos/1')
    const s = within(await seccion())
    expect(await s.findByText('Hacer chequeo')).toBeInTheDocument()
    for (const t of ['De otro objetivo', 'Del subobjetivo', 'De su proyecto', 'Suelta']) expect(s.queryByText(t)).not.toBeInTheDocument()
    expect(s.getByRole('link', { name: 'Ver todas en Ideas' })).toHaveAttribute('href', '/ideas?objetivo=1')
  })

  it('sin ideas ligadas muestra el texto de vacío', async () => {
    vi.mocked(getIdeas).mockResolvedValue([idea({ id: 1, objetivoId: 3 })])
    renderizar('/objetivos/1')
    expect(await within(await seccion()).findByText('Aún no hay ideas ligadas')).toBeInTheDocument()
  })

  it('si la lista de ideas falla, el resto del detalle sigue funcionando', async () => {
    vi.mocked(getIdeas).mockRejectedValue(new ApiError(500, 'Fallo de ideas'))
    renderizar('/objetivos/1')
    expect(await within(await seccion()).findByRole('alert')).toHaveTextContent('Fallo de ideas')
    expect(screen.getByRole('heading', { name: 'Salud', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tareas ligadas directamente', level: 2 })).toBeInTheDocument()
    expect(await screen.findByText('Plan')).toBeInTheDocument()
  })
})
