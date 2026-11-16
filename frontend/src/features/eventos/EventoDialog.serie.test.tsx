import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { zonaHoraria } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { SerieEventoCreada } from '@/types/serie'
import { DialogosEvento } from './DialogosEvento'
import { valoresParaHueco, type ValoresEvento } from './formularioEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
vi.mock('@/api/series', () => ({ crearSerie: vi.fn(), borrarSerieDesde: vi.fn() }))
import { actualizarEvento, crearEvento } from '@/api/eventos'
import { getRecordatoriosDeEvento } from '@/api/recordatorios'
import { crearSerie } from '@/api/series'

// Hoy es lunes 16 de noviembre de 2026; el evento nuevo se abre en el viernes 20, de 07:00 a 08:00.
const AHORA = '2026-11-16T10:00:00-03:00'
const INICIALES = valoresParaHueco('2026-11-20', 7 * 60)

const alMensaje = vi.fn()
const alCrear = vi.fn()

function evento(parcial: Partial<Evento> = {}): Evento {
  return {
    id: 9,
    titulo: 'Gimnasio',
    descripcion: '',
    fechaHoraInicio: '2026-11-16T07:00:00-03:00',
    fechaHoraFin: '2026-11-16T08:00:00-03:00',
    prioridad: null,
    serieId: 5,
    ...parcial,
  }
}

function creada(parcial: Partial<SerieEventoCreada> = {}): SerieEventoCreada {
  return {
    serie: {
      id: 5,
      frecuencia: 'SEMANAL',
      diasSemana: ['VIERNES'],
      intervaloSemanas: 1,
      diaMes: null,
      fechaInicio: '2026-11-20',
      hasta: null,
      repeticiones: 2,
      zonaHoraria: 'America/Argentina/Buenos_Aires',
    },
    eventos: [evento({ id: 1, fechaHoraInicio: '2026-11-20T07:00:00-03:00', fechaHoraFin: '2026-11-20T08:00:00-03:00' }), evento({ id: 2, fechaHoraInicio: '2026-11-27T07:00:00-03:00', fechaHoraFin: '2026-11-27T08:00:00-03:00' })],
    recordatoriosCreados: 0,
    recordatoriosOmitidos: 0,
    ...parcial,
  }
}

function Pagina({ abrir }: { abrir: { evento: Evento } | { iniciales: ValoresEvento } }) {
  const acciones = useAccionesEvento({ alMensaje, alCrear })
  const nuevo = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" ref={nuevo} onClick={() => ('evento' in abrir ? acciones.abrirEditar(abrir.evento) : acciones.abrirCrear(abrir.iniciales))}>
        Abrir
      </button>
      <DialogosEvento acciones={acciones} focoAlternativo={nuevo} />
    </>
  )
}

async function montar(abrir: { evento: Evento } | { iniciales: ValoresEvento } = { iniciales: INICIALES }) {
  const user = userEvent.setup({ advanceTimers: () => undefined })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <Pagina abrir={abrir} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return { user, invalidar }
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement
const cambiar = (nombre: string, valor: string) => fireEvent.change(campo(nombre), { target: { value: valor } })
const dia = (nombre: string) => screen.getByRole('checkbox', { name: nombre })
const dialogo = () => screen.queryByRole('dialog')

function pendiente<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => {
    resolver = r
  })
  return { promesa, resolver }
}

/** Abre el diálogo de creación, escribe el título y elige «Cada semana» (el viernes ya viene marcado). */
async function conSemanal() {
  const montado = await montar()
  await montado.user.type(campo('Título'), 'Gimnasio')
  await montado.user.selectOptions(campo('Repetir'), 'SEMANAL')
  return montado
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(AHORA))
  vi.resetAllMocks()
  vi.mocked(crearSerie).mockResolvedValue(creada())
  vi.mocked(crearEvento).mockImplementation(async (r) => ({ id: 50, serieId: null, ...r }))
  vi.mocked(actualizarEvento).mockImplementation(async (id, r) => ({ id, serieId: 5, ...r }))
  vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('EventoDialog: «Repetir» al crear', () => {
  it('«No se repite» por defecto: sin días ni final, y los campos de día siguen visibles', async () => {
    await montar()
    expect(campo('Repetir').value).toBe('no')
    expect(screen.queryByText('Días de la semana')).not.toBeInTheDocument()
    expect(campo('Día de inicio').value).toBe('2026-11-20')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('al editar un evento no existe «Repetir» (la regla no se cambia después)', async () => {
    await montar({ evento: evento() })
    expect(screen.queryByLabelText('Repetir')).not.toBeInTheDocument()
  })

  it('«Cada semana» marca el día de la semana elegido, oculta los campos de día y muestra la vista previa', async () => {
    await conSemanal()
    expect(dia('viernes')).toBeChecked()
    expect(dia('lunes')).not.toBeChecked()
    expect(screen.queryByLabelText('Día de inicio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Día de fin')).not.toBeInTheDocument()
    expect(campo('Hora de inicio').value).toBe('07:00')
    expect(campo('Hora de fin').value).toBe('08:00')
    // 10 viernes desde hoy (lunes 16): el primero es el 20 y el último el 22 de enero.
    expect(screen.getByText('Se crearán 10 eventos, del vie 20 nov al vie 22 ene.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear serie' })).toBeInTheDocument()
  })

  it('una hora de fin anterior a la de inicio dice que termina al día siguiente', async () => {
    await conSemanal()
    cambiar('Hora de inicio', '23:00')
    cambiar('Hora de fin', '01:00')
    expect(screen.getByText('Termina al día siguiente.')).toBeInTheDocument()
  })

  it('crear una serie semanal manda el POST con el cuerpo exacto, avisa, refresca y va al primer evento', async () => {
    const { user, invalidar } = await conSemanal()
    await user.click(dia('lunes'))
    await user.click(dia('miércoles'))
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(crearSerie).toHaveBeenCalledTimes(1)
    expect(crearSerie).toHaveBeenCalledWith({
      titulo: 'Gimnasio',
      descripcion: '',
      prioridad: null,
      horaInicio: '07:00',
      horaFin: '08:00',
      zonaHoraria: zonaHoraria(),
      ahora: AHORA,
      frecuencia: 'SEMANAL',
      diasSemana: ['LUNES', 'MIERCOLES', 'VIERNES'],
      intervaloSemanas: 1,
      repeticiones: 10,
    })
    expect(crearEvento).not.toHaveBeenCalled()
    expect(alMensaje).toHaveBeenCalledWith('Serie «Gimnasio» creada: 2 eventos, del vie 20 nov al vie 27 nov', { persistente: false })
    expect(alCrear).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['eventos'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it('cada 2 semanas, con «El día» como final', async () => {
    const { user } = await conSemanal()
    await user.selectOptions(campo('Frecuencia'), '2')
    await user.click(screen.getByRole('radio', { name: 'El día' }))
    cambiar('Fecha final', '2027-01-29')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    await waitFor(() => expect(crearSerie).toHaveBeenCalled())
    const pedido = vi.mocked(crearSerie).mock.calls[0]?.[0]
    expect(pedido).toMatchObject({ frecuencia: 'SEMANAL', intervaloSemanas: 2, hasta: '2027-01-29' })
    expect(pedido).not.toHaveProperty('repeticiones')
  })

  it('mensual: día del mes (el de la fecha elegida), aviso de los meses cortos y solo diaMes en el cuerpo', async () => {
    const { user } = await montar()
    await user.type(campo('Título'), 'Alquiler')
    await user.selectOptions(campo('Repetir'), 'MENSUAL')
    expect(campo('Día del mes').value).toBe('20')
    expect(screen.queryByText(/Los meses que no tienen ese día/)).not.toBeInTheDocument()
    cambiar('Día del mes', '31')
    expect(screen.getByText('Los meses que no tienen ese día usan su último día.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    await waitFor(() => expect(crearSerie).toHaveBeenCalled())
    const pedido = vi.mocked(crearSerie).mock.calls[0]?.[0]
    expect(pedido).toMatchObject({ frecuencia: 'MENSUAL', diaMes: 31, repeticiones: 10 })
    expect(pedido).not.toHaveProperty('diasSemana')
    expect(pedido).not.toHaveProperty('intervaloSemanas')
  })

  it('el recordatorio es opcional: marcado manda los minutos (60 por defecto)', async () => {
    const { user } = await conSemanal()
    await user.click(screen.getByRole('checkbox', { name: 'Avisarme antes de cada evento' }))
    expect(campo('Minutos antes del evento').value).toBe('60')
    cambiar('Minutos antes del evento', '30')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    await waitFor(() => expect(crearSerie).toHaveBeenCalled())
    expect(vi.mocked(crearSerie).mock.calls[0]?.[0].recordatorio).toEqual({ minutosAntes: 30 })
    expect(alMensaje).toHaveBeenCalledWith(expect.stringContaining('con recordatorio 30 min antes'), { persistente: false })
  })

  it('un recordatorio omitido es un aviso PERSISTENTE que dice cuántos y por qué', async () => {
    vi.mocked(crearSerie).mockResolvedValue(creada({ recordatoriosCreados: 1, recordatoriosOmitidos: 1 }))
    const { user } = await conSemanal()
    await user.click(screen.getByRole('checkbox', { name: 'Avisarme antes de cada evento' }))
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(alMensaje).toHaveBeenCalledWith(
      'Serie «Gimnasio» creada: 2 eventos, del vie 20 nov al vie 27 nov, con recordatorio 60 min antes. 1 recordatorio no se creó porque su hora ya había pasado (el evento sí se creó).',
      { persistente: true },
    )
  })
})

describe('EventoDialog: «Repetir» y «Todo el día»', () => {
  it('con «Todo el día» marcado, «Repetir» queda deshabilitado y dice por qué', async () => {
    const { user } = await montar()
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(campo('Repetir')).toBeDisabled()
    expect(screen.getByText('Los eventos de todo el día no se pueden repetir.')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(campo('Repetir')).toBeEnabled()
    expect(screen.queryByText('Los eventos de todo el día no se pueden repetir.')).not.toBeInTheDocument()
  })

  it('repitiendo, «Todo el día» queda deshabilitado y dice cómo habilitarlo', async () => {
    await conSemanal()
    expect(screen.getByRole('checkbox', { name: 'Todo el día' })).toBeDisabled()
    expect(screen.getByText('Para marcar «Todo el día», elige «No se repite».')).toBeInTheDocument()
  })
})

describe('EventoDialog: volver a «No se repite»', () => {
  it('restaura el día de inicio y el de fin que tenía el formulario (y conserva las horas editadas)', async () => {
    const { user } = await montar()
    cambiar('Día de fin', '2026-11-22')
    await user.selectOptions(campo('Repetir'), 'SEMANAL')
    expect(screen.queryByLabelText('Día de inicio')).not.toBeInTheDocument()
    // Editar la hora de inicio en modo serie no corre el fin ni toca los días.
    cambiar('Hora de inicio', '11:00')
    await user.selectOptions(campo('Repetir'), 'no')
    expect(campo('Día de inicio').value).toBe('2026-11-20')
    expect(campo('Día de fin').value).toBe('2026-11-22')
    expect(campo('Hora de inicio').value).toBe('11:00')
    expect(campo('Hora de fin').value).toBe('08:00')
  })

  it('si con las horas editadas el fin quedaría antes del inicio, pasa al día siguiente', async () => {
    const { user } = await montar()
    await user.selectOptions(campo('Repetir'), 'SEMANAL')
    cambiar('Hora de inicio', '23:00')
    cambiar('Hora de fin', '01:00')
    await user.selectOptions(campo('Repetir'), 'no')
    expect(campo('Día de inicio').value).toBe('2026-11-20')
    expect(campo('Día de fin').value).toBe('2026-11-21')
  })

  it('al volver a elegir «Cada semana» se conserva lo que se había elegido', async () => {
    const { user } = await montar()
    await user.selectOptions(campo('Repetir'), 'SEMANAL')
    await user.click(dia('lunes'))
    await user.selectOptions(campo('Repetir'), 'no')
    await user.selectOptions(campo('Repetir'), 'SEMANAL')
    expect(dia('lunes')).toBeChecked()
    expect(dia('viernes')).toBeChecked()
  })
})

describe('EventoDialog: validación de «Repetir» sin llamar al servidor', () => {
  it('semanal sin ningún día', async () => {
    const { user } = await conSemanal()
    await user.click(dia('viernes'))
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByText('Elige al menos un día de la semana')).toBeInTheDocument()
    expect(crearSerie).not.toHaveBeenCalled()
  })

  it('261 veces: error junto a «Termina» y el foco va al campo', async () => {
    const { user } = await conSemanal()
    cambiar('Número de veces', '261')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByText('Indica entre 1 y 260 veces')).toBeInTheDocument()
    expect(campo('Número de veces')).toHaveFocus()
    expect(crearSerie).not.toHaveBeenCalled()
  })

  it('un final que generaría más de 260 eventos', async () => {
    const { user } = await conSemanal()
    for (const nombre of ['lunes', 'martes', 'miércoles', 'jueves', 'sábado', 'domingo']) await user.click(dia(nombre))
    await user.click(screen.getByRole('radio', { name: 'El día' }))
    cambiar('Fecha final', '2100-01-01')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByText('Serían más de 260 eventos, que es el máximo: elige un final más cercano')).toBeInTheDocument()
    expect(crearSerie).not.toHaveBeenCalled()
  })

  it('horas iguales: error en las horas', async () => {
    const { user } = await conSemanal()
    cambiar('Hora de fin', '07:00')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    const error = await screen.findByText('La hora de fin debe ser distinta de la de inicio')
    expect(campo('Hora de inicio')).toHaveAttribute('aria-describedby', error.id)
    expect(crearSerie).not.toHaveBeenCalled()
  })

  it('el título vacío y un error de «Repetir» se ven a la vez; tocar un control limpia el error', async () => {
    const { user } = await montar()
    await user.selectOptions(campo('Repetir'), 'SEMANAL')
    await user.click(dia('viernes'))
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('Elige al menos un día de la semana')).toBeInTheDocument()
    await user.click(dia('lunes'))
    expect(screen.queryByText('Elige al menos un día de la semana')).not.toBeInTheDocument()
  })

  it('minutos del recordatorio fuera de rango', async () => {
    const { user } = await conSemanal()
    await user.click(screen.getByRole('checkbox', { name: 'Avisarme antes de cada evento' }))
    cambiar('Minutos antes del evento', '10081')
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByText('Indica entre 0 y 10080 minutos')).toBeInTheDocument()
    expect(crearSerie).not.toHaveBeenCalled()
  })
})

describe('EventoDialog: errores y doble envío al crear una serie', () => {
  it('un 400 del servidor se muestra tal cual en el diálogo, que sigue abierto con lo escrito', async () => {
    const mensaje = 'La serie generaría más de 260 eventos; el máximo es 260: elige un final más cercano'
    vi.mocked(crearSerie).mockRejectedValue(new ApiError(400, mensaje))
    const { user } = await conSemanal()
    await user.click(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await within(screen.getByRole('dialog')).findByText(mensaje)).toBeInTheDocument()
    expect(campo('Título').value).toBe('Gimnasio')
    expect(screen.getByRole('button', { name: 'Crear serie' })).toBeEnabled()
    expect(alMensaje).not.toHaveBeenCalled()
  })

  it('doble clic en «Crear serie» = un solo POST; mientras crea todo queda deshabilitado', async () => {
    const respuesta = pendiente<SerieEventoCreada>()
    vi.mocked(crearSerie).mockReturnValue(respuesta.promesa)
    const { user } = await conSemanal()
    await user.dblClick(screen.getByRole('button', { name: 'Crear serie' }))
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(campo('Repetir')).toBeDisabled()
    respuesta.resolver(creada())
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(crearSerie).toHaveBeenCalledTimes(1)
  })
})

describe('EventoDialog: editar un evento de una serie', () => {
  it('ofrece el alcance (por defecto «Solo este evento», sin la nota provisional); guarda con el PUT de siempre', async () => {
    const { user } = await montar({ evento: evento() })
    expect(screen.queryByText(/Los cambios valen solo para este evento/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Solo este evento' })).toBeChecked()
    await user.type(campo('Título'), ' (tarde)')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledWith(9, expect.objectContaining({ titulo: 'Gimnasio (tarde)' }))
    expect(crearSerie).not.toHaveBeenCalled()
  })

  it('un evento suelto no tiene selector de alcance ni nota', async () => {
    await montar({ evento: evento({ serieId: null }) })
    expect(screen.queryByText(/Forma parte de una serie/)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Solo este evento' })).not.toBeInTheDocument()
  })
})
