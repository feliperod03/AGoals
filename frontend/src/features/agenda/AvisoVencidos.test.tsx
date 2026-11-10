import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Recordatorio } from '@/types/recordatorio'
import { AvisoVencidos } from './AvisoVencidos'

vi.mock('@/api/recordatorios', () => ({ getRecordatoriosVencidos: vi.fn(), marcarRecordatorioEnviado: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTarea: vi.fn() }))
vi.mock('@/api/eventos', () => ({ getEvento: vi.fn() }))
import { getEvento } from '@/api/eventos'
import { getRecordatoriosVencidos, marcarRecordatorioEnviado } from '@/api/recordatorios'
import { getTarea } from '@/api/tareas'

function recordatorio(id: number, parcial: Partial<Recordatorio> = {}): Recordatorio {
  return {
    id,
    tareaId: null,
    eventoId: null,
    fechaHora: '2026-11-10T08:00:00-03:00',
    canal: 'APP',
    enviado: false,
    descripcion: `Recordatorio ${id}`,
    ...parcial,
  }
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AvisoVencidos />
    </QueryClientProvider>,
  )
}

const marcar = vi.mocked(marcarRecordatorioEnviado)
const vencidos = vi.mocked(getRecordatoriosVencidos)

beforeEach(() => {
  vencidos.mockReset().mockResolvedValue([])
  marcar.mockReset()
  vi.mocked(getTarea).mockReset()
  vi.mocked(getEvento).mockReset()
})
afterEach(() => vi.useRealTimers())

describe('AvisoVencidos', () => {
  it('sin vencidos no muestra nada, pero la región sigue en el DOM', async () => {
    renderizar()
    await waitFor(() => expect(vencidos).toHaveBeenCalled())
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('con 2 vencidos muestra texto, fecha y «Entendido»', async () => {
    vencidos.mockResolvedValue([recordatorio(1), recordatorio(2)])
    renderizar()
    expect(await screen.findByText('Recordatorio 1')).toBeInTheDocument()
    expect(screen.getByText('Recordatorio 2')).toBeInTheDocument()
    expect(screen.getAllByText(/^Para el /)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Entendido: Recordatorio 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Entendido: Recordatorio 2' })).toBeEnabled()
  })

  it('con más de 5 muestra 5 filas y «+N más pendientes»', async () => {
    vencidos.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map((i) => recordatorio(i)))
    renderizar()
    expect(await screen.findByText('+2 más pendientes')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Entendido/ })).toHaveLength(5)
    expect(screen.queryByText('Recordatorio 6')).not.toBeInTheDocument()
  })

  it('sin descripción usa el título de la tarea', async () => {
    vi.mocked(getTarea).mockResolvedValue({ id: 9, titulo: 'Pagar la luz' } as Awaited<ReturnType<typeof getTarea>>)
    vencidos.mockResolvedValue([recordatorio(1, { descripcion: null, tareaId: 9 })])
    renderizar()
    expect(await screen.findByText('Pagar la luz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entendido: Pagar la luz' })).toBeInTheDocument()
  })

  it('no manda ningún PATCH al montar ni al mostrarse', async () => {
    vencidos.mockResolvedValue([recordatorio(1)])
    renderizar()
    await screen.findByText('Recordatorio 1')
    expect(marcar).not.toHaveBeenCalled()
  })

  it('«Entendido» manda el PATCH con el id y la fila desaparece al refrescar', async () => {
    vencidos.mockResolvedValueOnce([recordatorio(1), recordatorio(2)]).mockResolvedValue([recordatorio(2)])
    marcar.mockResolvedValue(recordatorio(1, { enviado: true }))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido: Recordatorio 1' }))
    expect(marcar).toHaveBeenCalledExactlyOnceWith(1)
    await waitFor(() => expect(screen.queryByText('Recordatorio 1')).not.toBeInTheDocument())
    expect(screen.getByText('Recordatorio 2')).toBeInTheDocument()
  })

  it('un doble clic hace una sola llamada', async () => {
    vencidos.mockResolvedValue([recordatorio(1)])
    marcar.mockImplementation(() => new Promise(() => {}))
    renderizar()
    const boton = await screen.findByRole('button', { name: 'Entendido: Recordatorio 1' })
    await userEvent.dblClick(boton)
    expect(marcar).toHaveBeenCalledTimes(1)
    expect(boton).toBeDisabled()
  })

  it('con error 500 muestra el mensaje y el botón vuelve a estar activo', async () => {
    vencidos.mockResolvedValue([recordatorio(1)])
    marcar.mockRejectedValue(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido: Recordatorio 1' }))
    expect(await screen.findByText(/Error del servidor \(500\)/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entendido: Recordatorio 1' })).toBeEnabled())
  })

  it('con error 404 muestra el mensaje y vuelve a pedir la lista', async () => {
    vencidos.mockResolvedValueOnce([recordatorio(1)]).mockResolvedValue([])
    marcar.mockRejectedValue(new ApiError(404, 'No se encontró el recordatorio'))
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido: Recordatorio 1' }))
    await waitFor(() => expect(vencidos).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Recordatorio 1')).not.toBeInTheDocument())
  })

  it('si falla la consulta de vencidos no muestra error ni rompe la página', async () => {
    vencidos.mockRejectedValue(new ApiError(0, 'No se pudo conectar'))
    renderizar()
    await waitFor(() => expect(vencidos).toHaveBeenCalled())
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByText(/conectar/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si el polling falla conserva lo último que mostraba', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vencidos.mockResolvedValueOnce([recordatorio(1)]).mockRejectedValue(new ApiError(500, 'caído'))
    renderizar()
    expect(await screen.findByText('Recordatorio 1')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    await waitFor(() => expect(vencidos).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Recordatorio 1')).toBeInTheDocument()
    expect(screen.queryByText('caído')).not.toBeInTheDocument()
  })

  it('el polling pide de nuevo a los 30 s con un `ahora` distinto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
    renderizar()
    await waitFor(() => expect(vencidos).toHaveBeenCalledTimes(1))
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    await waitFor(() => expect(vencidos).toHaveBeenCalledTimes(2))
    const [primero, segundo] = vencidos.mock.calls.map(([ahora]) => ahora)
    expect(segundo).not.toBe(primero)
  })
})
