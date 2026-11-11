import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getEventos } from '@/api/eventos'
import { getTareas } from '@/api/tareas'
import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { CalendarioPage } from './CalendarioPage'

vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))

let siguienteId = 1

function tarea(extra: Partial<Tarea> = {}): Tarea {
  return {
    id: siguienteId++,
    titulo: 'Tarea',
    descripcion: null,
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
    ...extra,
  }
}

function evento(titulo: string, inicio: string, fin: string, extra: Partial<Evento> = {}): Evento {
  return { id: siguienteId++, titulo, descripcion: null, fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null, ...extra }
}

/** Muestra la ubicación y permite «atrás» del historial, para comprobar push y replace. */
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

function montar(entradas: string[] = ['/calendario']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
        <Routes>
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Auxiliar />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const celda = (etiqueta: RegExp | string) => screen.getByRole('button', { name: etiqueta })
const detalle = () => within(screen.getByRole('complementary', { name: 'Detalle del día' }))
const titulo = () => screen.getByRole('heading', { level: 1 })
const detalleTitulo = () => screen.getByRole('heading', { level: 2 })

function pendiente<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => {
    resolver = r
  })
  return { promesa, resolver }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.mocked(getEventos).mockReset().mockResolvedValue([])
  vi.mocked(getTareas).mockReset().mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('CalendarioPage: datos', () => {
  it('pide los eventos del rango de la cuadrícula y las tareas una sola vez', async () => {
    montar()
    await waitFor(() => expect(getEventos).toHaveBeenCalled())
    expect(getEventos).toHaveBeenCalledWith({ desde: '2026-10-26T00:00:00-03:00', hasta: '2026-12-07T00:00:00-03:00' })
    expect(getTareas).toHaveBeenCalledTimes(1)
  })

  it('muestra el mes, marca hoy y lo deja seleccionado con su detalle', async () => {
    montar()
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
    expect(celda(/martes 10 de noviembre/)).toHaveAttribute('aria-current', 'date')
    expect(detalleTitulo()).toHaveTextContent('martes 10 de noviembre')
    expect(await detalle().findByText('Nada para este día.')).toBeInTheDocument()
  })

  it('muestra eventos y tareas en su día; la HECHA se ve y la CANCELADA no', async () => {
    vi.mocked(getEventos).mockResolvedValue([evento('Reunión', '2026-11-12T10:00:00-03:00', '2026-11-12T11:00:00-03:00')])
    vi.mocked(getTareas).mockResolvedValue([
      tarea({ titulo: 'Pagar luz', fecha: '2026-11-12' }),
      tarea({ titulo: 'Ya hecha', fecha: '2026-11-12', estado: 'HECHO' }),
      tarea({ titulo: 'Descartada', fecha: '2026-11-12', estado: 'CANCELADO' }),
      tarea({ titulo: 'Sin fecha', fecha: null }),
    ])
    montar()
    const jueves = celda(/jueves 12 de noviembre/)
    expect(await within(jueves).findByText('Reunión')).toBeInTheDocument()
    expect(within(jueves).getByText('Pagar luz')).toBeInTheDocument()
    expect(within(jueves).getByText('Ya hecha')).toHaveClass('line-through')
    expect(screen.queryByText('Descartada')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin fecha')).not.toBeInTheDocument()
    expect(jueves).toHaveAccessibleName('jueves 12 de noviembre, 1 evento, 2 tareas')
  })

  it('mientras carga muestra la cuadrícula y «Cargando…»', () => {
    vi.mocked(getEventos).mockReturnValue(new Promise(() => {}))
    montar()
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
  })

  it('al terminar de cargar desaparece «Cargando…»', async () => {
    montar()
    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
  })
})

describe('CalendarioPage: errores independientes', () => {
  it('si fallan los eventos, las tareas se siguen viendo y el error sale en línea', async () => {
    vi.mocked(getEventos).mockRejectedValue(new Error('boom'))
    vi.mocked(getTareas).mockResolvedValue([tarea({ titulo: 'Pagar luz' })])
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los eventos: boom')
    expect(within(celda(/martes 10 de noviembre/)).getByText('Pagar luz')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('si fallan las tareas, los eventos se siguen viendo', async () => {
    vi.mocked(getEventos).mockResolvedValue([evento('Reunión', '2026-11-10T10:00:00-03:00', '2026-11-10T11:00:00-03:00')])
    vi.mocked(getTareas).mockRejectedValue(new Error('caído'))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las tareas: caído')
    expect(await within(celda(/martes 10 de noviembre/)).findByText('Reunión')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('CalendarioPage: navegación', () => {
  it('«Mes siguiente» y «Mes anterior» cambian el título y piden el rango nuevo', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    await waitFor(() =>
      expect(getEventos).toHaveBeenLastCalledWith({ desde: '2026-11-30T00:00:00-03:00', hasta: '2027-01-04T00:00:00-03:00' }),
    )
    // En otro mes, sin `dia`, queda seleccionado el día 1.
    expect(detalleTitulo()).toHaveTextContent('martes 1 de diciembre')

    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(titulo()).toHaveTextContent('Octubre de 2026')
  })

  it('«Hoy» vuelve al mes actual con hoy seleccionado', async () => {
    montar(['/calendario?mes=2027-02&dia=2027-02-14'])
    expect(titulo()).toHaveTextContent('Febrero de 2027')
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('martes 10 de noviembre')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/calendario?mes=2026-11&dia=2026-11-10')
  })

  it('al cambiar de mes los eventos anteriores siguen visibles mientras llega la respuesta (sin parpadeo)', async () => {
    const dentista = evento('Dentista', '2026-12-01T09:00:00-03:00', '2026-12-01T10:00:00-03:00')
    const nueva = pendiente<Evento[]>()
    vi.mocked(getEventos).mockResolvedValueOnce([dentista]).mockReturnValueOnce(nueva.promesa)
    montar()
    // El 1/12 también está en la cuadrícula de noviembre.
    expect(await within(celda(/martes 1 de diciembre/)).findByText('Dentista')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(within(celda(/martes 1 de diciembre/)).getByText('Dentista')).toBeInTheDocument()

    nueva.resolver([evento('Cena', '2026-12-05T21:00:00-03:00', '2026-12-05T23:00:00-03:00')])
    expect(await within(celda(/sábado 5 de diciembre/)).findByText('Cena')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
    expect(within(celda(/martes 1 de diciembre/)).queryByText('Dentista')).not.toBeInTheDocument()
  })

  it('«atrás» del navegador vuelve al mes anterior', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
  })
})

describe('CalendarioPage: selección de día', () => {
  it('un clic en un día actualiza el detalle y la URL', async () => {
    montar()
    await userEvent.click(celda(/sábado 14 de noviembre/))
    expect(detalleTitulo()).toHaveTextContent('sábado 14 de noviembre')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/calendario?mes=2026-11&dia=2026-11-14')
  })

  it('un día de octubre visible se selecciona sin cambiar de mes', async () => {
    montar()
    await userEvent.click(celda(/jueves 29 de octubre/))
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('jueves 29 de octubre')
  })

  it('elegir un día no suma entradas al historial (replace)', async () => {
    montar(['/otra', '/calendario'])
    await userEvent.click(celda(/sábado 14 de noviembre/))
    await userEvent.click(celda(/domingo 15 de noviembre/))
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/otra')
  })

  it('con más de 3 elementos la celda muestra 2 y «+N más», y el detalle muestra todos', async () => {
    vi.mocked(getTareas).mockResolvedValue([1, 2, 3, 4].map((n) => tarea({ titulo: `Tarea ${n}`, prioridad: 'ALTA', id: n + 100 })))
    montar()
    const hoy = celda(/martes 10 de noviembre/)
    expect(await within(hoy).findByText('+2')).toBeInTheDocument()
    expect(hoy).toHaveTextContent('+2 más')
    expect(within(hoy).queryByText('Tarea 4')).not.toBeInTheDocument()
    for (const n of [1, 2, 3, 4]) expect(detalle().getByText(`Tarea ${n}`)).toBeInTheDocument()
  })

  it('el detalle muestra hora, estado, prioridad y «Atrasada»', async () => {
    vi.mocked(getEventos).mockResolvedValue([evento('Guardia', '2026-11-09T22:00:00-03:00', '2026-11-10T06:00:00-03:00', { prioridad: 'MEDIA' })])
    vi.mocked(getTareas).mockResolvedValue([tarea({ titulo: 'Vieja', fecha: '2026-11-05', prioridad: 'ALTA', estado: 'EN_PROGRESO' })])
    montar(['/calendario?dia=2026-11-05'])
    expect(await detalle().findByText('Vieja')).toBeInTheDocument()
    expect(detalle().getByText('Atrasada')).toBeInTheDocument()
    expect(detalle().getByText('Alta')).toBeInTheDocument()
    expect(detalle().getByText('En progreso')).toBeInTheDocument()
    expect(detalle().getByText('TAREA')).toBeInTheDocument()

    await userEvent.click(celda(/martes 10 de noviembre/))
    expect(await detalle().findByText('Guardia')).toBeInTheDocument()
    expect(detalle().getByText('EVENTO')).toBeInTheDocument()
    expect(detalle().getByText('hasta 06:00')).toBeInTheDocument()
    expect(detalle().getByText('Media')).toBeInTheDocument()
  })
})

describe('CalendarioPage: URL', () => {
  it('?mes=2027-02 abre febrero de 2027', () => {
    montar(['/calendario?mes=2027-02'])
    expect(titulo()).toHaveTextContent('Febrero de 2027')
    expect(detalleTitulo()).toHaveTextContent('lunes 1 de febrero')
  })

  it.each(['2026-13', 'abc', '2026-1', ''])('mes inválido (%j): cae al mes actual sin romper', (mes) => {
    montar([`/calendario?mes=${mes}`])
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('martes 10 de noviembre')
  })

  it('un día inexistente o fuera de la cuadrícula cae a la selección por defecto', () => {
    montar(['/calendario?mes=2026-11&dia=2026-02-30'])
    expect(detalleTitulo()).toHaveTextContent('martes 10 de noviembre')
  })

  it('un día válido de la URL queda seleccionado', () => {
    montar(['/calendario?mes=2026-11&dia=2026-11-20'])
    expect(detalleTitulo()).toHaveTextContent('viernes 20 de noviembre')
  })
})

describe('CalendarioPage: teclado e historial', () => {
  it('una flecha que cruza de mes hace push: «atrás» vuelve a noviembre', async () => {
    montar(['/calendario?mes=2026-11&dia=2026-11-30'])
    celda(/lunes 30 de noviembre/).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('lunes 7 de diciembre')
    await waitFor(() => expect(celda(/lunes 7 de diciembre/)).toHaveFocus())

    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
  })

  it('moverse dentro del mes visible no añade entradas: «atrás» sale del calendario', async () => {
    montar(['/otra', '/calendario'])
    celda(/martes 10 de noviembre/).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(detalleTitulo()).toHaveTextContent('miércoles 11 de noviembre')
    await waitFor(() => expect(celda(/miércoles 11 de noviembre/)).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/otra')
  })

  it('RePág pasa al mes anterior', async () => {
    montar()
    celda(/martes 10 de noviembre/).focus()
    await userEvent.keyboard('{PageUp}')
    expect(titulo()).toHaveTextContent('Octubre de 2026')
    expect(detalleTitulo()).toHaveTextContent('sábado 10 de octubre')
  })
})

describe('CalendarioPage: zona horaria', () => {
  it('en Kolkata (+05:30) un evento de las 23:30 en Buenos Aires cae el día siguiente', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.mocked(getEventos).mockResolvedValue([evento('Cena tardía', '2026-11-10T23:30:00-03:00', '2026-11-11T00:30:00-03:00')])
    montar()
    await waitFor(() =>
      expect(getEventos).toHaveBeenCalledWith({ desde: '2026-10-26T00:00:00+05:30', hasta: '2026-12-07T00:00:00+05:30' }),
    )
    expect(await within(celda(/miércoles 11 de noviembre/)).findByText('Cena tardía')).toBeInTheDocument()
    expect(within(celda(/martes 10 de noviembre/)).queryByText('Cena tardía')).not.toBeInTheDocument()
  })
})

// --- Vista semanal (9b) ---

const ubicacion = () => screen.getByTestId('ubicacion')
const atras = () => userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
const diaDeLaSemana = (nombre: RegExp | string) => screen.getByRole('group', { name: nombre })
const encabezado = (nombre: string) => screen.getByRole('button', { name: nombre })

describe('CalendarioPage: panel del mes', () => {
  it('un evento de 00:00 a 00:00 del día siguiente dice «Todo el día» (antes «00:00–00:00»)', async () => {
    vi.mocked(getEventos).mockResolvedValue([evento('Feriado', '2026-11-12T00:00:00-03:00', '2026-11-13T00:00:00-03:00')])
    montar(['/calendario?mes=2026-11&dia=2026-11-12'])
    expect(await detalle().findByText('Feriado')).toBeInTheDocument()
    expect(detalle().getByText('Todo el día')).toBeInTheDocument()
    expect(detalle().queryByText('00:00–00:00')).not.toBeInTheDocument()
  })
})

describe('CalendarioPage: selector de vista', () => {
  it('sin parámetros abre el mes con «Mes» pulsado', () => {
    montar()
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Mes → Semana conserva el día (push) y pide el rango de esa semana; «atrás» vuelve al mes', async () => {
    montar(['/calendario?mes=2026-12&dia=2026-12-15'])
    await userEvent.click(screen.getByRole('button', { name: 'Semana' }))
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-12-15')
    expect(titulo()).toHaveTextContent('14–20 de diciembre de 2026')
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(getEventos).toHaveBeenLastCalledWith({ desde: '2026-12-14T00:00:00-03:00', hasta: '2026-12-21T00:00:00-03:00' }),
    )
    expect(encabezado('martes 15')).toHaveAttribute('aria-pressed', 'true')
    await atras()
    expect(ubicacion()).toHaveTextContent('/calendario?mes=2026-12&dia=2026-12-15')
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
  })

  it('Semana → Mes lleva el día al mes que lo contiene', async () => {
    montar(['/calendario?vista=semana&dia=2026-12-31'])
    expect(titulo()).toHaveTextContent('28 de diciembre de 2026 – 3 de enero de 2027')
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
    expect(ubicacion()).toHaveTextContent('/calendario?mes=2026-12&dia=2026-12-31')
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('jueves 31 de diciembre')
  })

  it('pulsar la vista actual no navega', async () => {
    montar(['/otra', '/calendario'])
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }))
    await atras()
    expect(ubicacion()).toHaveTextContent('/otra')
  })
})

describe('CalendarioPage: semana', () => {
  it('pide los eventos de lunes 00:00 al lunes siguiente 00:00 y las tareas una sola vez', async () => {
    montar(['/calendario?vista=semana&dia=2026-11-10'])
    expect(titulo()).toHaveTextContent('9–15 de noviembre de 2026')
    await waitFor(() =>
      expect(getEventos).toHaveBeenCalledWith({ desde: '2026-11-09T00:00:00-03:00', hasta: '2026-11-16T00:00:00-03:00' }),
    )
    expect(getTareas).toHaveBeenCalledTimes(1)
  })

  it('muestra eventos y tareas en su día, con hoy marcado y sin panel de detalle', async () => {
    vi.mocked(getEventos).mockResolvedValue([evento('Reunión', '2026-11-12T10:00:00-03:00', '2026-11-12T11:00:00-03:00')])
    vi.mocked(getTareas).mockResolvedValue([tarea({ titulo: 'Pagar luz', fecha: '2026-11-12' })])
    montar(['/calendario?vista=semana&dia=2026-11-10'])
    const jueves = diaDeLaSemana(/^jueves 12 de noviembre/)
    expect(await within(jueves).findByText('Evento, 10:00–11:00, Reunión')).toBeInTheDocument()
    expect(within(jueves).getByText(/Tarea, sin hora, .*Pagar luz/)).toBeInTheDocument()
    expect(jueves).toHaveAccessibleName('jueves 12 de noviembre, 1 evento, 1 tarea')
    expect(encabezado('martes 10')).toHaveAttribute('aria-current', 'date')
    expect(screen.queryByRole('complementary', { name: 'Detalle del día' })).not.toBeInTheDocument()
  })

  it('«Semana siguiente» y «Semana anterior» hacen push conservando el día de la semana', async () => {
    montar(['/calendario?vista=semana&dia=2026-11-10'])
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-17')
    expect(titulo()).toHaveTextContent('16–22 de noviembre de 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }))
    expect(titulo()).toHaveTextContent('23–29 de noviembre de 2026')
    await atras()
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-17')
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(titulo()).toHaveTextContent('2–8 de noviembre de 2026')
  })

  it('una semana que cruza el mes tiene su título y su rango', async () => {
    montar(['/calendario?vista=semana&dia=2026-12-02'])
    expect(titulo()).toHaveTextContent('30 de noviembre – 6 de diciembre de 2026')
    await waitFor(() =>
      expect(getEventos).toHaveBeenCalledWith({ desde: '2026-11-30T00:00:00-03:00', hasta: '2026-12-07T00:00:00-03:00' }),
    )
  })

  it('una semana que cruza el año pide el rango de diciembre a enero', async () => {
    montar(['/calendario?vista=semana&dia=2027-01-01'])
    expect(titulo()).toHaveTextContent('28 de diciembre de 2026 – 3 de enero de 2027')
    await waitFor(() =>
      expect(getEventos).toHaveBeenCalledWith({ desde: '2026-12-28T00:00:00-03:00', hasta: '2027-01-04T00:00:00-03:00' }),
    )
  })

  it('elegir un día de la semana hace replace: «atrás» sale del calendario', async () => {
    montar(['/otra', '/calendario?vista=semana&dia=2026-11-10'])
    await userEvent.click(encabezado('jueves 12'))
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-12')
    expect(encabezado('jueves 12')).toHaveAttribute('aria-pressed', 'true')
    await atras()
    expect(ubicacion()).toHaveTextContent('/otra')
  })

  it('← desde el lunes pasa a la semana anterior (push) y el foco sigue al día', async () => {
    montar(['/calendario?vista=semana&dia=2026-11-09'])
    encabezado('lunes 9').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-08')
    expect(titulo()).toHaveTextContent('2–8 de noviembre de 2026')
    await waitFor(() => expect(encabezado('domingo 8')).toHaveFocus())
    await atras()
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-09')
  })

  it('URLs inválidas: una vista desconocida es el mes; un día inexistente en la semana es hoy', () => {
    montar(['/calendario?vista=xyz&dia=2026-12-15'])
    expect(titulo()).toHaveTextContent('Noviembre de 2026')
  })

  it('un día inexistente en la semana cae a la semana de hoy, sin reescribir la URL', () => {
    montar(['/calendario?vista=semana&dia=2026-02-30'])
    expect(titulo()).toHaveTextContent('9–15 de noviembre de 2026')
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-02-30')
  })

  it('las URLs de 9a siguen abriendo el mes (también con vista=mes)', () => {
    montar(['/calendario?vista=mes&mes=2026-12&dia=2026-12-15'])
    expect(titulo()).toHaveTextContent('Diciembre de 2026')
    expect(detalleTitulo()).toHaveTextContent('martes 15 de diciembre')
  })

  it('si fallan los eventos, las tareas de la semana se siguen viendo', async () => {
    vi.mocked(getEventos).mockRejectedValue(new Error('boom'))
    vi.mocked(getTareas).mockResolvedValue([tarea({ titulo: 'Pagar luz' })])
    montar(['/calendario?vista=semana&dia=2026-11-10'])
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los eventos: boom')
    expect(within(diaDeLaSemana(/^martes 10 de noviembre/)).getByText(/Tarea, sin hora, .*Pagar luz/)).toBeInTheDocument()
  })

  it('en Kolkata (+05:30) el rango de la semana lleva ese desfase y el evento cae en su día local', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.mocked(getEventos).mockResolvedValue([evento('Cena tardía', '2026-11-10T23:30:00-03:00', '2026-11-11T00:30:00-03:00')])
    montar(['/calendario?vista=semana&dia=2026-11-10'])
    await waitFor(() =>
      expect(getEventos).toHaveBeenCalledWith({ desde: '2026-11-09T00:00:00+05:30', hasta: '2026-11-16T00:00:00+05:30' }),
    )
    expect(await within(diaDeLaSemana(/^miércoles 11 de noviembre/)).findByText('Evento, 08:00–09:00, Cena tardía')).toBeInTheDocument()
  })
})

describe('CalendarioPage: «Hoy» no apila entradas', () => {
  it('en la semana, «Hoy» dos veces deja una sola entrada', async () => {
    montar(['/otra', '/calendario?vista=semana&dia=2026-12-15'])
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-11-10')
    await atras()
    expect(ubicacion()).toHaveTextContent('/calendario?vista=semana&dia=2026-12-15')
  })

  it('en el mes, «Hoy» dos veces deja una sola entrada', async () => {
    montar(['/otra', '/calendario?mes=2027-02'])
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(ubicacion()).toHaveTextContent('/calendario?mes=2026-11&dia=2026-11-10')
    await atras()
    expect(ubicacion()).toHaveTextContent('/calendario?mes=2027-02')
  })

  it('si ya se está en hoy, «Hoy» no añade nada aunque los parámetros vengan en otro orden', async () => {
    montar(['/otra', '/calendario?dia=2026-11-10&mes=2026-11'])
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    await atras()
    expect(ubicacion()).toHaveTextContent('/otra')
  })
})
