import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({ getAgenda: vi.fn() }))
import { getAgenda } from '@/api/tareas'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 1,
    titulo: 'Tarea',
    descripcion: '',
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: '2026-11-10',
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.resetAllMocks())

describe('HoyPage', () => {
  it('lista las tareas con hora y las de la lista del día', async () => {
    const agenda: Agenda = {
      fecha: '2026-11-10',
      conHora: [tarea({ id: 1, titulo: 'Reunión con el equipo', horaInicio: '09:30:00', horaFin: '10:30:00', prioridad: 'ALTA' })],
      sinHora: [tarea({ id: 2, titulo: 'Comprar pan', prioridad: 'BAJA' }), tarea({ id: 3, titulo: 'Llamar al banco', estado: 'HECHO' })],
    }
    vi.mocked(getAgenda).mockResolvedValue(agenda)

    renderizar()

    expect(await screen.findByText('Reunión con el equipo')).toBeInTheDocument()
    expect(screen.getByText('09:30–10:30')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Comprar pan')).toBeInTheDocument()
    expect(screen.getByText('Baja')).toBeInTheDocument()
    expect(screen.getByText('Llamar al banco')).toHaveClass('line-through')
    expect(screen.getByRole('heading', { name: 'Planificación por horas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lista del día' })).toBeInTheDocument()
  })

  it('pide la agenda del día de hoy', async () => {
    vi.mocked(getAgenda).mockResolvedValue({ fecha: '', conHora: [], sinHora: [] })
    renderizar()
    await screen.findByText('No tienes tareas para hoy.')
    expect(getAgenda).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('muestra el estado vacío cuando no hay tareas', async () => {
    vi.mocked(getAgenda).mockResolvedValue({ fecha: '2026-11-10', conHora: [], sinHora: [] })
    renderizar()
    expect(await screen.findByText('No tienes tareas para hoy.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Lista del día' })).not.toBeInTheDocument()
  })

  it('muestra "cargando" mientras espera', () => {
    vi.mocked(getAgenda).mockReturnValue(new Promise(() => {}))
    renderizar()
    expect(screen.getByText('Cargando tu agenda…')).toBeInTheDocument()
  })

  it('muestra el mensaje del error de la API', async () => {
    vi.mocked(getAgenda).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })
})
