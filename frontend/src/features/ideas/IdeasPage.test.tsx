import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { renderizarIdeas } from '@/test/renderIdeas'
import { idea } from './fabrica'

vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn(), crearIdea: vi.fn(), actualizarIdea: vi.fn(), concluirIdea: vi.fn(), reabrirIdea: vi.fn(), borrarIdea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
import { getIdeas } from '@/api/ideas'
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

const IDEAS = [
  idea({ id: 1, titulo: 'Aprender a cantar', descripcion: 'En un coro', proyectoId: 5, fechaCreacion: '2026-11-03T10:00:00-03:00' }),
  idea({ id: 2, titulo: 'Pintar la sala', estado: 'CONCLUIDA', objetivoId: 8, conclusion: 'Quedó lindo', fechaCreacion: '2026-11-01T10:00:00-03:00', fechaCierre: '2026-11-08T22:30:00-03:00' }),
  idea({ id: 3, titulo: 'Viajar', fechaCreacion: '2026-11-05T10:00:00-03:00' }),
]

beforeEach(() => {
  vi.mocked(getIdeas).mockResolvedValue(IDEAS)
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 5, nombre: 'Casa' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 8, nombre: 'Salud' })])
})
afterEach(() => vi.resetAllMocks())

/** Títulos de las filas visibles, en orden (salen del `aria-label` de su menú). */
const titulos = () => screen.queryAllByRole('button', { name: /^Acciones de «/ }).map((b) => /«(.*)»/.exec(b.getAttribute('aria-label') ?? '')?.[1])

describe('IdeasPage: lectura', () => {
  it('por defecto muestra las planteadas, las más recientes primero', async () => {
    renderizarIdeas()
    expect(await screen.findByText('Viajar')).toBeInTheDocument()
    expect(titulos()).toEqual(['Viajar', 'Aprender a cantar'])
    expect(screen.queryByText('Pintar la sala')).not.toBeInTheDocument()
    expect(screen.getByText('2 ideas')).toBeInTheDocument()
  })

  it('cada fila muestra estado (en texto), vínculo, descripción y fecha de creación', async () => {
    renderizarIdeas()
    await screen.findByText('Aprender a cantar')
    const fila = screen.getByText('Aprender a cantar').closest('li')!
    expect(within(fila).getByText('Planteada')).toBeInTheDocument()
    expect(within(fila).getByText('Proyecto: Casa')).toBeInTheDocument()
    expect(within(fila).getByText('En un coro')).toBeInTheDocument()
    expect(within(fila).getByText('Creada el 3 nov 2026')).toBeInTheDocument()
    expect(within(screen.getByText('Viajar').closest('li')!).getByText('Suelta')).toBeInTheDocument()
  })

  it('las concluidas muestran fecha de cierre, objetivo y la conclusión', async () => {
    const user = userEvent.setup()
    renderizarIdeas()
    await screen.findByText('Viajar')
    await user.selectOptions(screen.getByLabelText('Estado'), 'concluidas')
    const fila = (await screen.findByText('Pintar la sala')).closest('li')!
    expect(titulos()).toEqual(['Pintar la sala'])
    expect(within(fila).getByText('Concluida')).toBeInTheDocument()
    expect(within(fila).getByText('Objetivo: Salud')).toBeInTheDocument()
    expect(within(fila).getByText('Cerrada el 8 nov 2026')).toBeInTheDocument()
    expect(fila).toHaveTextContent('Conclusión: Quedó lindo')
  })

  it('«Todas» ordena las concluidas por cierre y las planteadas por creación', async () => {
    const user = userEvent.setup()
    renderizarIdeas()
    await screen.findByText('Viajar')
    await user.selectOptions(screen.getByLabelText('Estado'), 'todas')
    // Pintar (cerrada el 8) > Viajar (creada el 5) > Aprender (creada el 3).
    await vi.waitFor(() => expect(titulos()).toEqual(['Pintar la sala', 'Viajar', 'Aprender a cantar']))
  })

  it('busca por título y descripción sin tildes ni mayúsculas', async () => {
    const user = userEvent.setup()
    renderizarIdeas()
    await screen.findByText('Viajar')
    await user.type(screen.getByLabelText('Buscar en título y descripción'), 'CORO')
    expect(titulos()).toEqual(['Aprender a cantar'])
    await user.clear(screen.getByLabelText('Buscar en título y descripción'))
    await user.type(screen.getByLabelText('Buscar en título y descripción'), 'vIaJáR')
    expect(titulos()).toEqual(['Viajar'])
  })

  it('si el vínculo apunta a algo que la lista no tiene, dice «n.º N»', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(0, 'sin conexión'))
    renderizarIdeas()
    expect(await screen.findByText('Proyecto: n.º 5')).toBeInTheDocument()
    expect(screen.getByText(/No se pudieron cargar los proyectos u objetivos/)).toBeInTheDocument()
  })
})

describe('IdeasPage: estados vacíos y de error', () => {
  it('mientras carga dice «Cargando ideas…»', () => {
    vi.mocked(getIdeas).mockReturnValue(new Promise(() => {}))
    renderizarIdeas()
    expect(screen.getByText('Cargando ideas…')).toBeInTheDocument()
  })

  it('sin ninguna idea: «Aún no tienes ideas.»', async () => {
    vi.mocked(getIdeas).mockResolvedValue([])
    renderizarIdeas()
    expect(await screen.findByText('Aún no tienes ideas.')).toBeInTheDocument()
  })

  it('con ideas pero ninguna planteada: «No hay ideas planteadas.»', async () => {
    vi.mocked(getIdeas).mockResolvedValue(IDEAS.filter((i) => i.estado === 'CONCLUIDA'))
    renderizarIdeas()
    expect(await screen.findByText('No hay ideas planteadas.')).toBeInTheDocument()
  })

  it('el texto de vacío nombra los filtros activos', async () => {
    const user = userEvent.setup()
    renderizarIdeas()
    await screen.findByText('Viajar')
    await user.selectOptions(screen.getByLabelText('Estado'), 'concluidas')
    await user.type(screen.getByLabelText('Buscar en título y descripción'), 'zzz')
    expect(screen.getByText('No hay ideas con estos filtros: Concluidas, Título o descripción contiene «zzz».')).toBeInTheDocument()
  })

  it('«Volver a la vista por defecto» restablece los filtros', async () => {
    const user = userEvent.setup()
    renderizarIdeas()
    await screen.findByText('Viajar')
    expect(screen.queryByRole('button', { name: 'Volver a la vista por defecto' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Buscar en título y descripción'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Volver a la vista por defecto' }))
    expect(titulos()).toEqual(['Viajar', 'Aprender a cantar'])
    expect(screen.getByLabelText('Buscar en título y descripción')).toHaveValue('')
  })

  it('un fallo de red al cargar se muestra como alerta', async () => {
    vi.mocked(getIdeas).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    renderizarIdeas()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })
})
