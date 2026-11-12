import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento, EventoRequest } from '@/types/evento'
import { CalendarioPage } from './CalendarioPage'

// Integración de 9c en el calendario: puntos de entrada, navegación tras guardar (P8), foco y refrescos.

vi.mock('@/api/eventos', () => ({
  getEventos: vi.fn(),
  getEvento: vi.fn(),
  crearEvento: vi.fn(),
  actualizarEvento: vi.fn(),
  borrarEvento: vi.fn(),
}))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
import { actualizarEvento, borrarEvento, crearEvento, getEventos } from '@/api/eventos'
import { getRecordatoriosDeEvento } from '@/api/recordatorios'
import { getTareas } from '@/api/tareas'

/** «Servidor» en memoria: lo que se crea, edita o borra se ve en el siguiente GET. */
let servidor: Evento[] = []
let siguienteId = 1

const evento = (titulo: string, inicio: string, fin: string): Evento => ({
  id: siguienteId++,
  titulo,
  descripcion: '',
  fechaHoraInicio: inicio,
  fechaHoraFin: fin,
  prioridad: null,
})

function Auxiliar() {
  const ubicacion = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <span data-testid="ubicacion">{ubicacion.pathname + ubicacion.search}</span>
      <button type="button" onClick={() => navigate(-1)}>
        Atrás
      </button>
    </>
  )
}

function montar(entrada: string) {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/fuera', entrada]} initialIndex={1}>
        <Routes>
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="*" element={<p>Fuera del calendario</p>} />
        </Routes>
        <Auxiliar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return user
}

const ubicacion = () => screen.getByTestId('ubicacion').textContent
const dialogo = () => within(screen.getByRole('dialog'))
const campo = (nombre: string) => dialogo().getByLabelText(nombre) as HTMLInputElement
// `hidden: true`: con un diálogo abierto la página queda `aria-hidden`.
const panel = () => within(screen.getByRole('complementary', { name: 'Detalle del día', hidden: true }))
const nuevoEvento = () => screen.getByRole('button', { name: 'Nuevo evento' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:20:00-03:00'))
  servidor = []
  vi.mocked(getEventos).mockReset().mockImplementation(async () => [...servidor])
  vi.mocked(getTareas).mockReset().mockResolvedValue([])
  vi.mocked(getRecordatoriosDeEvento).mockReset().mockResolvedValue([])
  vi.mocked(crearEvento)
    .mockReset()
    .mockImplementation(async (r: EventoRequest) => {
      const nuevo = { id: siguienteId++, ...r }
      servidor.push(nuevo)
      return nuevo
    })
  vi.mocked(actualizarEvento)
    .mockReset()
    .mockImplementation(async (id: number, r: EventoRequest) => {
      const nuevo = { id, ...r }
      servidor = servidor.map((e) => (e.id === id ? nuevo : e))
      return nuevo
    })
  vi.mocked(borrarEvento)
    .mockReset()
    .mockImplementation(async (id: number) => {
      servidor = servidor.filter((e) => e.id !== id)
    })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CalendarioPage 9c: crear', () => {
  it('«Nuevo evento» en el mes usa el día seleccionado (otro día: 09:00–10:00)', async () => {
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(nuevoEvento())
    expect(dialogo().getByRole('heading', { name: 'Nuevo evento' })).toBeInTheDocument()
    expect(campo('Día de inicio').value).toBe('2026-12-15')
    expect(campo('Hora de inicio').value).toBe('09:00')
    expect(campo('Hora de fin').value).toBe('10:00')
  })

  it('con hoy seleccionado empieza en la hora en punto posterior a ahora (12:20 → 13:00)', async () => {
    const user = montar('/calendario')
    await user.click(nuevoEvento())
    expect(campo('Día de inicio').value).toBe('2026-11-10')
    expect(campo('Hora de inicio').value).toBe('13:00')
    expect(campo('Hora de fin').value).toBe('14:00')
  })

  it('«Agregar evento» del panel usa el día del panel', async () => {
    const user = montar('/calendario?mes=2026-12&dia=2026-12-20')
    await user.click(panel().getByRole('button', { name: 'Agregar evento el domingo 20 de diciembre' }))
    expect(campo('Día de inicio').value).toBe('2026-12-20')
  })

  it('crear en un día visible: lo selecciona con replace, avisa y se ve en el panel; no vuelve a pedir tareas', async () => {
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await waitFor(() => expect(getTareas).toHaveBeenCalledTimes(1))
    const pedidosAntes = vi.mocked(getEventos).mock.calls.length
    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Dentista')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-22' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-22'))
    expect(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' })).toBeInTheDocument()
    expect(screen.getByText('Evento «Dentista» creado (mar 22 dic, 09:00–10:00)')).toBeInTheDocument()
    expect(vi.mocked(getEventos).mock.calls.length).toBeGreaterThan(pedidosAntes)
    expect(getTareas).toHaveBeenCalledTimes(1)
    // Replace: «atrás» sale del calendario en vez de volver al 15.
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(await screen.findByText('Fuera del calendario')).toBeInTheDocument()
  })

  it('crear en otro mes: salta a ese mes con push («atrás» vuelve)', async () => {
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Vacaciones')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2027-01-05' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2027-01&dia=2027-01-05'))
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-15'))
  })

  it('tras crear desde «Nuevo evento», el foco vuelve a «Nuevo evento»', async () => {
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Dentista')
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(nuevoEvento()).toHaveFocus())
  })

  it('con la lista de eventos fallida «Nuevo evento» sigue disponible', async () => {
    vi.mocked(getEventos).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    expect(await screen.findByText(/No se pudieron cargar los eventos/)).toBeInTheDocument()
    await user.click(nuevoEvento())
    expect(dialogo().getByRole('heading', { name: 'Nuevo evento' })).toBeInTheDocument()
  })

  it('con la lista de eventos cargando, «Nuevo evento» ya funciona y no hay botones de edición', async () => {
    vi.mocked(getEventos).mockReturnValue(new Promise(() => {}))
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    expect(screen.queryByRole('button', { name: /^Editar evento/ })).not.toBeInTheDocument()
    await user.click(nuevoEvento())
    expect(dialogo().getByRole('heading', { name: 'Nuevo evento' })).toBeInTheDocument()
  })
})

describe('CalendarioPage 9c: editar y borrar', () => {
  it('editar desde el panel no navega y el aviso usa los datos guardados', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' }))
    await user.clear(campo('Título'))
    await user.type(campo('Título'), 'Dentista (control)')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2027-02-01' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-15')
    expect(screen.getByText('Evento «Dentista (control)» guardado (lun 1 feb, 09:00–10:00)')).toBeInTheDocument()
  })

  it('Escape devuelve el foco a la fila que abrió la edición', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    const fila = await panel().findByRole('button', { name: /^Editar evento: Dentista/ })
    await user.click(fila)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(panel().getByRole('button', { name: /^Editar evento: Dentista/ })).toHaveFocus())
  })

  it('borrar: el evento desaparece de la celda y del panel, avisa y el foco va a «Nuevo evento»', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: /^Editar evento: Dentista/ }))
    await user.click(dialogo().getByRole('button', { name: 'Borrar evento' }))
    const confirmar = await screen.findByRole('button', { name: 'Borrar' })
    await waitFor(() => expect(confirmar).toBeEnabled())
    await user.click(confirmar)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(panel().queryByRole('button', { name: /^Editar evento/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^martes 15 de diciembre/ })).toHaveAccessibleName('martes 15 de diciembre, sin elementos')
    expect(screen.getByText('Evento «Dentista» borrado')).toBeInTheDocument()
    await waitFor(() => expect(nuevoEvento()).toHaveFocus())
  })

  it('un 404 al guardar deja el mensaje real del servidor y refresca la lista', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    vi.mocked(actualizarEvento).mockImplementation(async (id: number) => {
      servidor = []
      throw new ApiError(404, `No existe el evento con id ${id}`)
    })
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: /^Editar evento: Dentista/ }))
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    expect(await dialogo().findByText(/^No existe el evento con id \d+$/)).toBeInTheDocument()
    await waitFor(() => expect(panel().queryByRole('button', { name: /^Editar evento/ })).not.toBeInTheDocument())
  })
})

describe('CalendarioPage 9c: atajos de mouse', () => {
  it('clic en el chip del mes: selecciona el día con replace y abre su edición; Escape devuelve el foco a la celda', async () => {
    const lunes = evento('Reunión', '2026-12-21T09:00:00-03:00', '2026-12-21T10:00:00-03:00')
    servidor = [lunes]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    const celda = await screen.findByRole('button', { name: 'lunes 21 de diciembre, 1 evento' })
    await user.click(celda.querySelector(`[data-evento-id="${lunes.id}"]`) as HTMLElement)
    expect(dialogo().getByRole('heading', { name: 'Editar evento' })).toBeInTheDocument()
    expect(campo('Título').value).toBe('Reunión')
    expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-21')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'lunes 21 de diciembre, 1 evento' })).toHaveFocus())
  })

  it('clic en un hueco del martes a las 10:00: abre «Nuevo evento» 10:00–11:00 y al guardar se queda en la semana', async () => {
    const user = montar('/calendario?vista=semana&dia=2026-12-15')
    await waitFor(() => expect(getEventos).toHaveBeenCalled())
    const martes = screen.getByRole('group', { name: /^martes 15 de diciembre/ })
    const linea = within(martes).getByTestId('linea-de-tiempo')
    linea.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 700, width: 100, height: 700, x: 0, y: 0, toJSON: () => ({}) })
    // Rango 08–21: las 10:00 están a 2 h × 48 px.
    fireEvent.click(linea, { clientY: 96 })
    expect(campo('Día de inicio').value).toBe('2026-12-15')
    expect(campo('Hora de inicio').value).toBe('10:00')
    expect(campo('Hora de fin').value).toBe('11:00')
    await user.type(campo('Título'), 'Hueco')
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({ fechaHoraInicio: '2026-12-15T10:00:00-03:00', fechaHoraFin: '2026-12-15T11:00:00-03:00' }),
    )
    expect(ubicacion()).toBe('/calendario?vista=semana&dia=2026-12-15')
    // Un hueco no enfoca nada: el foco va a «Nuevo evento».
    await waitFor(() => expect(nuevoEvento()).toHaveFocus())
  })
})
