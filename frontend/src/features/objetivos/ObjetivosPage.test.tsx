import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo } from '@/features/jerarquia/fabrica'
import { ObjetivosPage } from './ObjetivosPage'

vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ObjetivosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.mocked(getObjetivos).mockResolvedValue([]))
afterEach(() => vi.resetAllMocks())

const nombres = () => screen.getAllByRole('link').map((a) => a.textContent)

describe('ObjetivosPage', () => {
  it('muestra cargando y luego el vacío', async () => {
    renderizar()
    expect(screen.getByText('Cargando tus objetivos…')).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes objetivos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objetivos', level: 1 })).toBeInTheDocument()
  })

  it('muestra el error del servidor', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })

  it('arma el árbol de subobjetivos, sin línea de «Objetivo:», con enlaces al detalle', async () => {
    vi.mocked(getObjetivos).mockResolvedValue([
      objetivo({ id: 1, nombre: 'Salud' }),
      objetivo({ id: 2, nombre: 'Correr 10 km', padreId: 1, prioridad: 'MEDIA' }),
      objetivo({ id: 3, nombre: 'Hecho', estado: 'HECHO', padreId: 1 }),
    ])
    renderizar()
    await screen.findByText('Salud')
    expect(nombres()).toEqual(['Salud', 'Correr 10 km'])
    expect(screen.getByRole('link', { name: 'Correr 10 km' })).toHaveAttribute('href', '/objetivos/2')
    expect(screen.getByText('+1 subobjetivo oculto por el filtro')).toBeInTheDocument()
    expect(screen.queryByText(/^Objetivo:/)).not.toBeInTheDocument()
  })

  it('filtra por estado y por nombre, y se restablece', async () => {
    vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 1, nombre: 'Salud' }), objetivo({ id: 2, nombre: 'Viajar', estado: 'HECHO' })])
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Salud')
    await user.selectOptions(screen.getByLabelText('Estado'), 'todos')
    expect(nombres()).toEqual(['Salud', 'Viajar'])
    await user.type(screen.getByLabelText('Buscar por nombre'), 'zzz')
    expect(screen.getByText('Ningún objetivo coincide con los filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a la vista por defecto' }))
    expect(nombres()).toEqual(['Salud'])
  })
})
