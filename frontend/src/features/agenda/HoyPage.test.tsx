import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({ getAgenda: vi.fn(), getTarea: vi.fn() }))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn() }))
import { getEventos } from '@/api/eventos'
import { getRecordatorios } from '@/api/recordatorios'
import { getAgenda, getTarea } from '@/api/tareas'

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

function evento(parcial: Partial<Evento>): Evento {
  return {
    id: 1,
    titulo: 'Evento',
    descripcion: '',
    fechaHoraInicio: '2026-11-10T15:00:00-03:00',
    fechaHoraFin: '2026-11-10T16:00:00-03:00',
    prioridad: null,
    ...parcial,
  }
}

function recordatorio(parcial: Partial<Recordatorio>): Recordatorio {
  return { id: 1, tareaId: null, eventoId: null, fechaHora: '2026-11-11T09:00:00-03:00', enviado: false, descripcion: 'Aviso', ...parcial }
}

const AGENDA_VACIA: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [] }

/** Devuelve `delDia` si la consulta trae `hasta` (eventos del día) y `proximos` si no. */
function eventosSegunConsulta(delDia: Evento[], proximos: Evento[]) {
  vi.mocked(getEventos).mockImplementation(async (rango) => (rango?.hasta ? delDia : proximos))
}

function configurar({ agenda = AGENDA_VACIA, delDia = [] as Evento[], proximos = [] as Evento[], recordatorios = [] as Recordatorio[] } = {}) {
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  eventosSegunConsulta(delDia, proximos)
  vi.mocked(getRecordatorios).mockResolvedValue(recordatorios)
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // Solo se falsea `Date` (no los timers): TanStack Query sigue funcionando normal.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
})
afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('HoyPage: datos', () => {
  it('muestra encabezado, resumen, lista del día y planificación por horas', async () => {
    configurar({
      agenda: {
        fecha: '2026-11-10',
        conHora: [tarea({ id: 1, titulo: 'Reunión con el equipo', horaInicio: '09:30:00', horaFin: '10:30:00', prioridad: 'ALTA' })],
        sinHora: [
          tarea({ id: 2, titulo: 'Comprar pan', prioridad: 'BAJA' }),
          tarea({ id: 3, titulo: 'Llamar al banco', estado: 'HECHO' }),
          tarea({ id: 4, titulo: 'Preparar informe', estado: 'EN_PROGRESO', prioridad: 'MEDIA' }),
        ],
      },
      delDia: [evento({ id: 9, titulo: 'Dentista' })],
    })

    renderizar()

    expect(await screen.findByText('Comprar pan')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hoy', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('martes, 10 de noviembre de 2026')).toBeInTheDocument()
    // Abiertas: la reunión, "Comprar pan" y "Preparar informe" (la hecha no cuenta).
    expect(await screen.findByText('3 tareas abiertas, 1 evento')).toBeInTheDocument()

    const lista = screen.getByRole('heading', { name: 'Lista del día' }).closest('section')!
    expect(within(lista).getByText('Baja')).toBeInTheDocument()
    expect(within(lista).getByText('Media')).toBeInTheDocument()
    expect(within(lista).getByText('Llamar al banco')).toHaveClass('line-through', 'text-mut')
    expect(within(lista).getByText('Comprar pan')).not.toHaveClass('line-through')
    expect(within(lista).getByText('Hecha')).toHaveClass('sr-only')
    expect(within(lista).getByText('En progreso')).toBeInTheDocument()
    expect(within(lista).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(lista).queryByRole('button')).not.toBeInTheDocument()

    const plan = screen.getByRole('heading', { name: 'Planificación por horas' }).closest('section')!
    expect(within(plan).getByText('TAREA · 09:30–10:30')).toBeInTheDocument()
    expect(within(plan).getByText('Reunión con el equipo')).toBeInTheDocument()
    expect(within(plan).getByText('EVENTO · 15:00–16:00')).toBeInTheDocument()
    expect(within(plan).getByText('Dentista')).toBeInTheDocument()
    expect(within(plan).getByText('08:00')).toBeInTheDocument()
    expect(within(plan).getByText('21:00')).toBeInTheDocument()
  })

  it('pide la agenda y los eventos del día de hoy', async () => {
    configurar()
    renderizar()
    await screen.findByText('Aún no tienes eventos.')
    expect(getAgenda).toHaveBeenCalledWith('2026-11-10')
    expect(getEventos).toHaveBeenCalledWith({ desde: '2026-11-10T00:00:00-03:00', hasta: '2026-11-11T00:00:00-03:00' })
    expect(getEventos).toHaveBeenCalledWith({ desde: '2026-11-10T12:00:00-03:00' })
  })

  it('recorta al día un evento que cruza la medianoche y amplía el rango', async () => {
    configurar({ delDia: [evento({ titulo: 'Guardia', fechaHoraInicio: '2026-11-09T22:00:00-03:00', fechaHoraFin: '2026-11-10T01:30:00-03:00' })] })
    renderizar()
    expect(await screen.findByText('EVENTO · 00:00–01:30')).toBeInTheDocument()
    expect(screen.getByText('00:00')).toBeInTheDocument()
  })

  it('una tarea con hora sin fin dura 30 minutos', async () => {
    configurar({ agenda: { fecha: '2026-11-10', conHora: [tarea({ titulo: 'Llamada', horaInicio: '11:00:00' })], sinHora: [] } })
    renderizar()
    expect(await screen.findByText('TAREA · 11:00–11:30')).toBeInTheDocument()
  })

  it('coloca los bloques solapados lado a lado', async () => {
    configurar({
      agenda: {
        fecha: '2026-11-10',
        conHora: [tarea({ id: 1, titulo: 'Uno', horaInicio: '10:00:00', horaFin: '11:30:00' })],
        sinHora: [],
      },
      delDia: [evento({ titulo: 'Dos', fechaHoraInicio: '2026-11-10T10:30:00-03:00', fechaHoraFin: '2026-11-10T11:00:00-03:00' })],
    })
    renderizar()
    const uno = (await screen.findByText('Uno')).parentElement!
    const dos = screen.getByText('Dos').parentElement!
    expect(uno.style.width).toBe('calc(50% - 4px)')
    expect(dos.style.width).toBe('calc(50% - 4px)')
    expect(uno.style.left).toBe('0%')
    expect(dos.style.left).toBe('50%')
  })
})

describe('HoyPage: línea de "ahora"', () => {
  it('aparece cuando la hora actual está dentro del rango', async () => {
    configurar()
    renderizar()
    expect(await screen.findByTestId('linea-ahora')).toHaveAccessibleName('Ahora, 12:00')
  })

  it('no aparece si la hora actual queda fuera del rango', async () => {
    vi.setSystemTime(new Date('2026-11-10T22:30:00-03:00'))
    configurar()
    renderizar()
    await screen.findByText('Aún no tienes eventos.')
    expect(screen.queryByTestId('linea-ahora')).not.toBeInTheDocument()
  })

  it('aparece fuera de 08-21 si el rango se amplió', async () => {
    vi.setSystemTime(new Date('2026-11-10T22:30:00-03:00'))
    configurar({ agenda: { fecha: '2026-11-10', conHora: [tarea({ horaInicio: '22:00:00', horaFin: '23:00:00' })], sinHora: [] } })
    renderizar()
    expect(await screen.findByTestId('linea-ahora')).toBeInTheDocument()
  })
})

describe('HoyPage: columna lateral', () => {
  it('muestra solo los 3 primeros eventos y recordatorios próximos', async () => {
    configurar({
      proximos: [1, 2, 3, 4, 5].map((n) => evento({ id: n, titulo: 'Evento ' + n, fechaHoraInicio: '2026-11-1' + n + 'T10:00:00-03:00', fechaHoraFin: '2026-11-1' + n + 'T11:00:00-03:00' })),
      recordatorios: [5, 4, 3, 2, 1].map((n) => recordatorio({ id: n, descripcion: 'Aviso ' + n, fechaHora: '2026-11-1' + n + 'T09:00:00-03:00' })),
    })
    renderizar()
    const eventos = (await screen.findByRole('heading', { name: 'Próximos eventos' })).closest('section')!
    expect(await within(eventos).findByText('Evento 3')).toBeInTheDocument()
    expect(within(eventos).queryByText('Evento 4')).not.toBeInTheDocument()
    expect(within(eventos).getByText('mié 11 nov · 10:00')).toBeInTheDocument()

    const recs = screen.getByRole('heading', { name: 'Próximos recordatorios' }).closest('section')!
    expect(await within(recs).findByText('Aviso 1')).toBeInTheDocument()
    expect(within(recs).getByText('Aviso 3')).toBeInTheDocument()
    expect(within(recs).queryByText('Aviso 4')).not.toBeInTheDocument()
  })

  it('deja fuera los recordatorios enviados o ya pasados', async () => {
    configurar({
      recordatorios: [
        recordatorio({ id: 1, descripcion: 'Ya enviado', enviado: true }),
        recordatorio({ id: 2, descripcion: 'Ya pasó', fechaHora: '2026-11-10T08:00:00-03:00' }),
        recordatorio({ id: 3, descripcion: 'Vigente' }),
      ],
    })
    renderizar()
    expect(await screen.findByText('Vigente')).toBeInTheDocument()
    expect(screen.queryByText('Ya enviado')).not.toBeInTheDocument()
    expect(screen.queryByText('Ya pasó')).not.toBeInTheDocument()
  })

  it('sin descripción, muestra el título de la tarea vinculada', async () => {
    vi.mocked(getTarea).mockResolvedValue(tarea({ id: 7, titulo: 'Pagar la luz' }))
    configurar({ recordatorios: [recordatorio({ descripcion: '', tareaId: 7 })] })
    renderizar()
    expect(await screen.findByText('Pagar la luz')).toBeInTheDocument()
    expect(getTarea).toHaveBeenCalledWith(7)
  })

  it('si no se puede consultar la tarea vinculada, usa un texto genérico', async () => {
    vi.mocked(getTarea).mockRejectedValue(new ApiError(404, 'No se encontró lo que buscabas.'))
    configurar({ recordatorios: [recordatorio({ descripcion: '', tareaId: 7 })] })
    renderizar()
    expect(await screen.findByText('Recordatorio de una tarea')).toBeInTheDocument()
  })

  it('muestra los estados vacíos', async () => {
    configurar()
    renderizar()
    expect(await screen.findByText('Aún no tienes recordatorios.')).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes eventos.')).toBeInTheDocument()
  })
})

describe('HoyPage: estados de la página', () => {
  it('muestra "cargando" mientras espera', () => {
    vi.mocked(getAgenda).mockReturnValue(new Promise(() => {}))
    vi.mocked(getEventos).mockReturnValue(new Promise(() => {}))
    vi.mocked(getRecordatorios).mockReturnValue(new Promise(() => {}))
    renderizar()
    expect(screen.getAllByText('Cargando tu agenda…')).toHaveLength(2)
    expect(screen.getAllByText('Cargando…')).toHaveLength(2)
  })

  it('muestra los estados vacíos de las dos tarjetas', async () => {
    configurar()
    renderizar()
    expect(await screen.findByText('No tienes tareas sin hora para hoy.')).toBeInTheDocument()
    expect(screen.getByText('No hay nada planificado por horas para hoy.')).toBeInTheDocument()
    expect(await screen.findByText('0 tareas abiertas, 0 eventos')).toBeInTheDocument()
  })

  it('muestra el mensaje del error de la API sin tumbar el resto', async () => {
    configurar({ recordatorios: [recordatorio({ descripcion: 'Sigue funcionando' })] })
    vi.mocked(getAgenda).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    renderizar()
    const alertas = await screen.findAllByRole('alert')
    expect(alertas.length).toBeGreaterThan(0)
    for (const a of alertas) expect(a).toHaveTextContent('No se pudo conectar con el servidor.')
    expect(await screen.findByText('Sigue funcionando')).toBeInTheDocument()
  })

  it('un error en los recordatorios no afecta a la agenda', async () => {
    configurar({ agenda: { fecha: '2026-11-10', conHora: [], sinHora: [tarea({ titulo: 'Comprar pan' })] } })
    vi.mocked(getRecordatorios).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    renderizar()
    expect(await screen.findByText('Comprar pan')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor (500).')
  })

  it('no ofrece acciones (solo lectura)', async () => {
    configurar({ agenda: { fecha: '2026-11-10', conHora: [], sinHora: [tarea({ titulo: 'Comprar pan' })] } })
    renderizar()
    await screen.findByText('Comprar pan')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
