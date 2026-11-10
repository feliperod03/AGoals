import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { idea } from '@/features/ideas/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { ProyectoPage } from './ProyectoPage'

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
          <Route path="/proyectos/:id" element={<ProyectoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 1, nombre: 'Casa' }), proyecto({ id: 2, nombre: 'Mudanza', padreId: 1 }), proyecto({ id: 4, nombre: 'Otro' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 1, nombre: 'Mismo número' })])
  vi.mocked(getTareas).mockResolvedValue([])
})
afterEach(() => vi.resetAllMocks())

const seccion = async () => (await screen.findByRole('heading', { name: 'Ideas ligadas', level: 2 })).closest('section')!

describe('ProyectoPage: Ideas ligadas', () => {
  it('muestra las ideas de ese proyecto y no las de otro, las del subproyecto, las de un objetivo con el mismo id ni las sueltas', async () => {
    vi.mocked(getIdeas).mockResolvedValue([
      idea({ id: 1, titulo: 'Pintar la sala', proyectoId: 1 }),
      idea({ id: 2, titulo: 'Del otro proyecto', proyectoId: 4 }),
      idea({ id: 3, titulo: 'Del subproyecto', proyectoId: 2 }),
      idea({ id: 4, titulo: 'De un objetivo', objetivoId: 1 }),
      idea({ id: 5, titulo: 'Suelta' }),
    ])
    renderizar('/proyectos/1')
    const s = within(await seccion())
    expect(await s.findByText('Pintar la sala')).toBeInTheDocument()
    for (const t of ['Del otro proyecto', 'Del subproyecto', 'De un objetivo', 'Suelta']) expect(s.queryByText(t)).not.toBeInTheDocument()
    expect(s.getByRole('link', { name: 'Ver todas en Ideas' })).toHaveAttribute('href', '/ideas?proyecto=1')
  })

  it('si la lista de ideas falla, el resto del detalle sigue funcionando', async () => {
    vi.mocked(getIdeas).mockRejectedValue(new ApiError(500, 'Fallo de ideas'))
    renderizar('/proyectos/1')
    expect(await within(await seccion()).findByRole('alert')).toHaveTextContent('Fallo de ideas')
    expect(screen.getByRole('heading', { name: 'Casa', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tareas ligadas', level: 2 })).toBeInTheDocument()
  })
})
