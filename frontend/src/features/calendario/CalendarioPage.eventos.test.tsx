import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento, EventoRequest } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
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
vi.mock('@/api/recordatorios', () => ({
  getRecordatoriosDeEvento: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { actualizarEvento, borrarEvento, crearEvento, getEventos } from '@/api/eventos'
import { actualizarRecordatorio, crearRecordatorio, getRecordatoriosDeEvento } from '@/api/recordatorios'
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
  serieId: null,
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
      const nuevo = { id: siguienteId++, serieId: null, ...r }
      servidor.push(nuevo)
      return nuevo
    })
  vi.mocked(actualizarEvento)
    .mockReset()
    .mockImplementation(async (id: number, r: EventoRequest) => {
      const nuevo = { id, serieId: null, ...r }
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

  it('crear en un día gris del mes siguiente cambia el encabezado y el mes (H-34)', async () => {
    // La cuadrícula de noviembre llega hasta el domingo 6 de diciembre: el 3 de diciembre se VE, pero es de otro mes.
    const user = montar('/calendario?mes=2026-11&dia=2026-11-10')
    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Dentista')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-03' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-03'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Diciembre de 2026')
    expect(await panel().findByRole('button', { name: 'Editar evento: Dentista, 13:00–14:00' })).toBeInTheDocument()
    // Hoy estaba seleccionado: el diálogo propone la próxima hora en punto (13:00).
    // Push: «atrás» vuelve a noviembre.
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2026-11&dia=2026-11-10'))
  })

  it('un clic en un día gris de otro mes solo lo selecciona: el mes no cambia (intencional)', async () => {
    const user = montar('/calendario?mes=2026-11&dia=2026-11-10')
    await user.click(await screen.findByRole('button', { name: /^jueves 3 de diciembre/ }))
    expect(ubicacion()).toBe('/calendario?mes=2026-11&dia=2026-12-03')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Noviembre de 2026')
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
  it('editar dentro del mes no navega y el aviso usa los datos guardados', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' }))
    await user.clear(campo('Título'))
    await user.type(campo('Título'), 'Dentista (control)')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-18' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-15')
    expect(screen.getByText('Evento «Dentista (control)» guardado (vie 18 dic, 09:00–10:00)')).toBeInTheDocument()
  })

  it('editar moviendo el evento a otro mes lleva a ese mes, con push (H-34)', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' }))
    fireEvent.change(campo('Día de inicio'), { target: { value: '2027-02-01' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2027-02&dia=2027-02-01'))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Febrero de 2027')
    expect(screen.getByText('Evento «Dentista» guardado (lun 1 feb, 09:00–10:00)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?mes=2026-12&dia=2026-12-15'))
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

describe('CalendarioPage H-30 y H-34 en la semana', () => {
  const scrollTo = vi.mocked(window.scrollTo)
  const grilla = () => within(screen.getByTestId('semana-por-horas'))
  beforeEach(() => {
    scrollTo.mockClear()
    servidor = [evento('Reunión', '2026-12-15T15:00:00-03:00', '2026-12-15T16:00:00-03:00')]
  })

  // Rango 08–21: las 15:00 con una hora de contexto (14:00) están a 6 h × 48 px = 288; − cabecera (56) − holgura (8) = 224.
  async function montarSemana() {
    const user = montar('/calendario?vista=semana&dia=2026-12-15')
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 224, behavior: 'auto' }))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    return user
  }

  it('abre la semana desplazada a la zona útil, una sola vez y cuando los eventos ya cargaron', async () => {
    await montarSemana()
  })

  it('abrir y cerrar el diálogo de un evento no desplaza la página', async () => {
    const user = await montarSemana()
    await user.click(grilla().getByRole('button', { name: 'Editar evento: Reunión, 15:00–16:00' }))
    expect(dialogo().getByRole('heading', { name: 'Editar evento' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(nuevoEvento())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('guardar un evento que se queda en la misma semana (editar o crear) no desplaza la página', async () => {
    const user = await montarSemana()
    await user.click(grilla().getByRole('button', { name: 'Editar evento: Reunión, 15:00–16:00' }))
    await user.type(campo('Título'), ' 2')
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(ubicacion()).toBe('/calendario?vista=semana&dia=2026-12-15')

    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Otro')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-17' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(ubicacion()).toBe('/calendario?vista=semana&dia=2026-12-17'))
    await grilla().findByRole('button', { name: /^Editar evento: Otro/ })
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('crear un evento en otra semana lleva a esa semana y la desplaza a SU zona útil', async () => {
    const user = await montarSemana()
    await user.click(nuevoEvento())
    await user.type(campo('Título'), 'Cena')
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-22' } })
    fireEvent.change(campo('Hora de inicio'), { target: { value: '17:00' } })
    fireEvent.change(campo('Hora de fin'), { target: { value: '18:00' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?vista=semana&dia=2026-12-22'))
    // 17:00 → desde las 16:00: 8 h × 48 = 384; − 64 = 320. Solo cuando los eventos de esa semana ya están.
    await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 320, behavior: 'auto' }))
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('editar un evento moviéndolo a otra semana lleva a esa semana y la desplaza', async () => {
    const user = await montarSemana()
    await user.click(grilla().getByRole('button', { name: 'Editar evento: Reunión, 15:00–16:00' }))
    fireEvent.change(campo('Día de inicio'), { target: { value: '2026-12-29' } })
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(ubicacion()).toBe('/calendario?vista=semana&dia=2026-12-29'))
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 224, behavior: 'auto' })
  })
})

describe('CalendarioPage 9d: recordatorio de un evento', () => {
  it('editar → «Recordatorio…» → crear → «Listo»: el botón pasa a mostrar la hora y el evento no se toca', async () => {
    servidor = [evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')]
    let recordatorios: Recordatorio[] = []
    vi.mocked(getRecordatoriosDeEvento).mockImplementation(async (id) => recordatorios.filter((r) => r.eventoId === id))
    vi.mocked(crearRecordatorio).mockImplementation(async (req) => {
      const nuevo = { id: 70, enviado: false, ...req }
      recordatorios = [nuevo]
      return nuevo
    })
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' }))
    await user.click(await screen.findByRole('button', { name: 'Recordatorio…' }))
    const recordatorio = within(await screen.findByRole('dialog', { name: 'Recordatorio de «Dentista»' }))
    const crear = await recordatorio.findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    await user.click(crear)
    await user.click(await recordatorio.findByRole('button', { name: 'Listo' }))
    expect(await screen.findByRole('button', { name: 'Recordatorio: mar 15 dic · 08:00' })).toBeInTheDocument()
    expect(screen.getByText('Recordatorio creado para el mar 15 dic · 08:00')).toBeInTheDocument()
    expect(actualizarEvento).not.toHaveBeenCalled()
  })
})

describe('CalendarioPage 9e: mover el recordatorio con el evento', () => {
  it('editar → mover el inicio → «Guardar»: el evento y su recordatorio se mueven y el aviso lo dice', async () => {
    const dentista = evento('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')
    servidor = [dentista]
    let recordatorios: Recordatorio[] = [
      { id: 70, tareaId: null, eventoId: dentista.id, fechaHora: '2026-12-15T08:00:00-03:00', canal: 'APP', enviado: false, descripcion: '' },
    ]
    vi.mocked(getRecordatoriosDeEvento).mockImplementation(async (id) => recordatorios.filter((r) => r.eventoId === id))
    vi.mocked(actualizarRecordatorio).mockImplementation(async (id, req) => {
      const movido = { id, enviado: false, ...req }
      recordatorios = recordatorios.map((r) => (r.id === id ? movido : r))
      return movido
    })
    const user = montar('/calendario?mes=2026-12&dia=2026-12-15')
    await user.click(await panel().findByRole('button', { name: 'Editar evento: Dentista, 09:00–10:00' }))
    await screen.findByRole('button', { name: 'Recordatorio: mar 15 dic · 08:00' })
    fireEvent.change(campo('Hora de inicio'), { target: { value: '09:45' } })
    expect(await screen.findByRole('checkbox', { name: 'Mover también el recordatorio (de 08:00 a 08:45)' })).toBeChecked()
    expect(screen.getByText('Quedará el mar 15 dic · 08:45.')).toBeInTheDocument()
    await user.click(dialogo().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledWith(
      dentista.id,
      expect.objectContaining({ fechaHoraInicio: '2026-12-15T09:45:00-03:00', fechaHoraFin: '2026-12-15T10:45:00-03:00' }),
    )
    expect(actualizarRecordatorio).toHaveBeenCalledWith(70, {
      tareaId: null,
      eventoId: dentista.id,
      fechaHora: '2026-12-15T08:45:00-03:00',
      canal: 'APP',
      descripcion: '',
    })
    expect(screen.getByText(/recordatorio movido al mar 15 dic · 08:45/)).toBeInTheDocument()
  })
})
