import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { ProyectosPage } from './ProyectosPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getProyectos).mockResolvedValue([])
  vi.mocked(getObjetivos).mockResolvedValue([])
})
afterEach(() => vi.resetAllMocks())

/** Los nombres de las filas en el orden en que aparecen. */
const nombres = () => screen.getAllByRole('link').map((a) => a.textContent)

describe('ProyectosPage: estados', () => {
  it('muestra cargando, y luego el vacío si no hay proyectos', async () => {
    renderizar()
    expect(screen.getByText('Cargando tus proyectos…')).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes proyectos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Proyectos', level: 1 })).toBeInTheDocument()
  })

  it('muestra el mensaje del servidor si la lista falla', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.queryByText('Aún no tienes proyectos.')).not.toBeInTheDocument()
  })
})

describe('ProyectosPage: árbol', () => {
  it('anida los subproyectos bajo su padre y cada nombre lleva al detalle', async () => {
    vi.mocked(getProyectos).mockResolvedValue([
      proyecto({ id: 1, nombre: 'Casa' }),
      proyecto({ id: 2, nombre: 'Mudanza', padreId: 1 }),
      proyecto({ id: 3, nombre: 'Cajas', padreId: 2 }),
      proyecto({ id: 4, nombre: 'Otro' }),
    ])
    renderizar()
    await screen.findByText('Casa')
    expect(nombres()).toEqual(['Casa', 'Mudanza', 'Cajas', 'Otro'])
    expect(screen.getByRole('link', { name: 'Cajas' })).toHaveAttribute('href', '/proyectos/3')
    expect(screen.getByText('4 proyectos')).toBeInTheDocument()
    const casa = screen.getByRole('link', { name: 'Casa' }).closest('li')!
    expect(within(casa).getByRole('link', { name: 'Mudanza' })).toBeInTheDocument()
    expect(within(casa).queryByRole('link', { name: 'Otro' })).not.toBeInTheDocument()
  })

  it('ordena por prioridad (alta primero) y luego por nombre', async () => {
    vi.mocked(getProyectos).mockResolvedValue([
      proyecto({ id: 1, nombre: 'Beta' }),
      proyecto({ id: 2, nombre: 'Zeta', prioridad: 'ALTA' }),
      proyecto({ id: 3, nombre: 'Alfa' }),
    ])
    renderizar()
    await screen.findByText('Zeta')
    expect(nombres()).toEqual(['Zeta', 'Alfa', 'Beta'])
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('muestra el estado de cada fila y a qué objetivo pertenece (con el número si el objetivo no cargó)', async () => {
    vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 5, nombre: 'Mudarme' })])
    vi.mocked(getProyectos).mockResolvedValue([
      proyecto({ id: 1, nombre: 'Casa', objetivoId: 5, estado: 'EN_PROGRESO' }),
      proyecto({ id: 2, nombre: 'Auto', objetivoId: 9 }),
      proyecto({ id: 3, nombre: 'Suelto' }),
    ])
    renderizar()
    await screen.findByText('Objetivo: Mudarme')
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de «Casa»' })).toHaveValue('EN_PROGRESO')
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de «Auto»' })).toHaveValue('PENDIENTE')
    expect(screen.getByText('Objetivo: n.º 9')).toBeInTheDocument()
    expect(screen.getAllByText(/^Objetivo:/)).toHaveLength(2)
  })

  it('si los objetivos fallan, la lista sigue mostrándose con una nota', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 1, nombre: 'Casa', objetivoId: 5 })])
    renderizar()
    expect(await screen.findByText('Objetivo: n.º 5')).toBeInTheDocument()
    expect(screen.getByText('No se pudieron cargar los objetivos: se muestran con su número.')).toBeInTheDocument()
  })

  it('datos con un ciclo, un autopadre o un padre inexistente no cuelgan la pantalla', async () => {
    vi.mocked(getProyectos).mockResolvedValue([
      proyecto({ id: 1, nombre: 'A', padreId: 2 }),
      proyecto({ id: 2, nombre: 'B', padreId: 1 }),
      proyecto({ id: 3, nombre: 'Yo mismo', padreId: 3 }),
      proyecto({ id: 4, nombre: 'Huérfano', padreId: 99 }),
    ])
    renderizar()
    await screen.findByText('Huérfano')
    expect(nombres().sort()).toEqual(['A', 'B', 'Huérfano', 'Yo mismo'])
  })
})

describe('ProyectosPage: filtros', () => {
  const PROYECTOS = [
    proyecto({ id: 1, nombre: 'Casa' }),
    proyecto({ id: 2, nombre: 'Mudanza', padreId: 1, estado: 'HECHO' }),
    proyecto({ id: 3, nombre: 'Viejo', estado: 'CANCELADO' }),
    proyecto({ id: 4, nombre: 'Acción social', estado: 'EN_PAUSA' }),
  ]

  it('por defecto muestra solo los abiertos y avisa de los subproyectos ocultos por el filtro', async () => {
    vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
    renderizar()
    await screen.findByText('Casa')
    expect(nombres()).toEqual(['Acción social', 'Casa'])
    expect(screen.getByText('+1 subproyecto oculto por el filtro')).toBeInTheDocument()
    expect(screen.getByText('2 proyectos')).toBeInTheDocument()
  })

  it('«Todos» y un estado concreto cambian la lista; un hijo cuyo padre no cumple sube a raíz y nombra al padre', async () => {
    vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')

    await user.selectOptions(screen.getByLabelText('Estado'), 'todos')
    expect(nombres()).toEqual(['Acción social', 'Casa', 'Mudanza', 'Viejo'])
    expect(screen.queryByText(/oculto/)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Estado'), 'HECHO')
    expect(nombres()).toEqual(['Mudanza'])
    expect(screen.getByText('Subproyecto de «Casa»')).toBeInTheDocument()
  })

  it('la búsqueda ignora tildes y mayúsculas', async () => {
    vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.type(screen.getByLabelText('Buscar por nombre'), 'ACCION')
    expect(nombres()).toEqual(['Acción social'])
    expect(screen.getByText('1 proyecto')).toBeInTheDocument()
  })

  it('sin coincidencias avisa y «Volver a la vista por defecto» restablece todo', async () => {
    vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    expect(screen.queryByRole('button', { name: 'Volver a la vista por defecto' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Buscar por nombre'), 'zzz')
    expect(screen.getByText('Ningún proyecto coincide con los filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a la vista por defecto' }))
    expect(screen.getByLabelText('Buscar por nombre')).toHaveValue('')
    expect(screen.getByLabelText('Estado')).toHaveValue('abiertos')
    expect(nombres()).toEqual(['Acción social', 'Casa'])
  })
})
