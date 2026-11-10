import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { idea } from './fabrica'
import { IdeasLigadas } from './IdeasLigadas'
import type { CampoVinculoIdea } from './ligadas'

vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn(), crearIdea: vi.fn(), actualizarIdea: vi.fn(), concluirIdea: vi.fn(), reabrirIdea: vi.fn(), borrarIdea: vi.fn() }))
import { getIdeas } from '@/api/ideas'

afterEach(() => vi.resetAllMocks())

function renderizar(campo: CampoVinculoIdea = 'proyectoId', id = 1) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IdeasLigadas campo={campo} id={id} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('IdeasLigadas', () => {
  it('lista planteadas y concluidas con su estado en texto, fecha y la conclusión', async () => {
    vi.mocked(getIdeas).mockResolvedValue([
      idea({ id: 1, titulo: 'Pintar la sala', proyectoId: 1, fechaCreacion: '2026-11-01T10:00:00-03:00' }),
      idea({ id: 2, titulo: 'Cambiar el piso', proyectoId: 1, estado: 'CONCLUIDA', conclusion: 'Sale caro, se descarta', fechaCierre: '2026-11-05T10:00:00-03:00' }),
      idea({ id: 3, titulo: 'De otro', proyectoId: 2 }),
      idea({ id: 4, titulo: 'Suelta' }),
    ])
    renderizar()
    expect(await screen.findByText('Pintar la sala')).toBeInTheDocument()
    expect(screen.getByText('Cambiar el piso')).toBeInTheDocument()
    expect(screen.queryByText('De otro')).not.toBeInTheDocument()
    expect(screen.queryByText('Suelta')).not.toBeInTheDocument()
    expect(screen.getByText('Planteada')).toBeInTheDocument()
    expect(screen.getByText('Concluida')).toBeInTheDocument()
    expect(screen.getByText(/Creada el 1 nov 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Cerrada el 5 nov 2026/)).toBeInTheDocument()
    expect(screen.getByText(/Sale caro, se descarta/)).toBeInTheDocument()
    // Más recientes primero: la concluida (cierre 5 nov) antes que la planteada (1 nov).
    const titulos = screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent)
    expect(titulos).toEqual(['Cambiar el piso', 'Pintar la sala'])
  })

  it('con ideas hay un enlace «Ver todas en Ideas» al vínculo preseleccionado y ningún botón de acción', async () => {
    vi.mocked(getIdeas).mockResolvedValue([idea({ id: 1, titulo: 'Una', objetivoId: 4 }), idea({ id: 2, titulo: 'Concluida', objetivoId: 4, estado: 'CONCLUIDA', conclusion: 'ok' })])
    renderizar('objetivoId', 4)
    await screen.findByText('Una')
    expect(screen.getByRole('link', { name: 'Ver todas en Ideas' })).toHaveAttribute('href', '/ideas?objetivo=4')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Nueva idea|Concluir|Editar|Borrar|Reabrir/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^\+\d+ más$/)).not.toBeInTheDocument()
  })

  it('con más de 5: muestra 5 y «+N más» apunta al mismo destino', async () => {
    vi.mocked(getIdeas).mockResolvedValue(Array.from({ length: 7 }, (_, n) => idea({ id: n + 1, titulo: `Idea ${n + 1}`, proyectoId: 1, fechaCreacion: `2026-11-0${n + 1}T10:00:00-03:00` })))
    renderizar()
    await screen.findByText('Idea 7')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('Idea 1')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+2 más' })).toHaveAttribute('href', '/ideas?proyecto=1')
    expect(screen.getByRole('link', { name: 'Ver todas en Ideas' })).toHaveAttribute('href', '/ideas?proyecto=1')
  })

  it('sin ideas ligadas: solo el texto, sin enlace', async () => {
    vi.mocked(getIdeas).mockResolvedValue([idea({ id: 1, proyectoId: 9 })])
    renderizar()
    expect(await screen.findByText('Aún no hay ideas ligadas')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('mientras carga muestra «Cargando ideas…»', () => {
    vi.mocked(getIdeas).mockReturnValue(new Promise(() => {}))
    renderizar()
    expect(screen.getByText('Cargando ideas…')).toBeInTheDocument()
  })

  it('si la lista falla muestra el mensaje y ningún enlace ni texto de vacío', async () => {
    vi.mocked(getIdeas).mockRejectedValue(new ApiError(500, 'No se pudieron cargar las ideas'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las ideas')
    expect(screen.queryByText('Aún no hay ideas ligadas')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
