import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Recordatorio } from '@/types/recordatorio'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'
import { PosponerDialog } from './PosponerDialog'
import { useAccionesTarea, type Acciones } from './useAccionesTarea'

vi.mock('@/api/tareas', () => ({
  getAgenda: vi.fn(),
  getTarea: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
  getTareas: vi.fn(),
}))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatorios: vi.fn(),
  getRecordatoriosDeTarea: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { getEventos } from '@/api/eventos'
import { actualizarRecordatorio, getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, getAgenda, getTareas, posponerTarea } from '@/api/tareas'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 7,
    titulo: 'Informe',
    descripcion: 'Detalle',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
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

function recordatorio(parcial: Partial<Recordatorio> = {}): Recordatorio {
  return { id: 50, tareaId: 7, eventoId: null, fechaHora: '2026-11-10T15:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Aviso', ...parcial }
}

function renderizar(t: Tarea = tarea({})) {
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [t] }
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
  return { invalidar }
}

type Usuario = ReturnType<typeof userEvent.setup>

async function abrirSelector(user: Usuario, esperarCarga = true) {
  await user.click(await screen.findByRole('button', { name: 'Acciones de «Informe»' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Posponer' }))
  const selector = await screen.findByRole('dialog', { name: 'Posponer tarea' })
  if (esperarCarga) await waitFor(() => expect(within(selector).getByRole('button', { name: 'Dejar sin fecha' })).toBeEnabled())
  return selector
}

const casilla = (selector: HTMLElement) => within(selector).queryByRole('checkbox', { name: /Mover también el recordatorio/ })
const manana = (selector: HTMLElement) => within(selector).getByRole('button', { name: /^Mañana/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio()])
  vi.mocked(getTareas).mockResolvedValue([])
  vi.mocked(posponerTarea).mockImplementation(async (_id, fecha) => tarea({ fecha }))
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({ fecha: null }))
  vi.mocked(actualizarRecordatorio).mockImplementation(async (id, req) => ({ id, enviado: false, ...req }))
})

describe('Posponer con recordatorio: casilla y movimiento', () => {
  it('sin recordatorio no hay casilla y solo se manda el PATCH', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
    const { invalidar } = renderizar()
    const selector = await abrirSelector(user)
    expect(casilla(selector)).not.toBeInTheDocument()

    await user.click(manana(selector))

    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11'))
    expect(await screen.findByRole('status')).toHaveTextContent(/^Pospuesta al 11 de noviembre$/)
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it('con recordatorio la casilla viene marcada y muestra la fecha actual y la nueva', async () => {
    const user = userEvent.setup()
    renderizar()
    const selector = await abrirSelector(user)
    const c = casilla(selector)
    expect(c).toBeChecked()
    expect(within(selector).getByText(/cae el mar 10 nov · 15:00/)).toBeInTheDocument()
    expect(within(selector).getByText('Con Mañana: mié 11 nov · 15:00')).toBeInTheDocument()
  })

  it('Mañana: primero el PATCH, luego el PUT con los cinco campos y la misma hora; avisa, cierra e invalida', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const selector = await abrirSelector(user)

    await user.click(manana(selector))

    await waitFor(() =>
      expect(actualizarRecordatorio).toHaveBeenCalledWith(50, {
        tareaId: 7,
        eventoId: null,
        fechaHora: '2026-11-11T15:00:00-03:00',
        canal: 'APP',
        descripcion: 'Aviso',
      }),
    )
    expect(vi.mocked(posponerTarea).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(actualizarRecordatorio).mock.invocationCallOrder[0]!)
    expect(await screen.findByRole('status')).toHaveTextContent('Pospuesta al 11 de noviembre; recordatorio movido al mié 11 nov · 15:00')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it('Elegir fecha con el aviso un día antes: se corre los mismos días de calendario, no a la misma fecha', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ fechaHora: '2026-11-09T15:00:00-03:00' })])
    renderizar()
    const selector = await abrirSelector(user)

    fireEvent.change(within(selector).getByLabelText('Elegir fecha'), { target: { value: '2026-11-14' } })
    expect(within(selector).getByText('Con la fecha elegida: vie 13 nov · 15:00')).toBeInTheDocument()
    // Tarea 10 -> 14 (+4 días): el aviso del 9 pasa al 13.
    await user.click(within(selector).getByRole('button', { name: 'Posponer a esa fecha' }))

    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-14'))
    await waitFor(() => expect(actualizarRecordatorio).toHaveBeenCalledWith(50, expect.objectContaining({ fechaHora: '2026-11-13T15:00:00-03:00' })))
  })

  it('con la casilla desmarcada no hay PUT ni mención del recordatorio', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const selector = await abrirSelector(user)
    await user.click(casilla(selector)!)
    expect(within(selector).getByText('El recordatorio se queda donde está.')).toBeInTheDocument()

    await user.click(manana(selector))

    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11'))
    expect(await screen.findByRole('status')).toHaveTextContent(/^Pospuesta al 11 de noviembre$/)
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it('un recordatorio ya enviado no genera pregunta ni PUT', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ enviado: true })])
    renderizar()
    const selector = await abrirSelector(user)
    expect(casilla(selector)).not.toBeInTheDocument()

    await user.click(manana(selector))

    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11'))
    expect(await screen.findByRole('status')).toHaveTextContent(/^Pospuesta al 11 de noviembre$/)
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
  })

  it('un recordatorio vencido sin enviar también se mueve; si seguirá en el pasado lo dice', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ fechaHora: '2020-01-01T09:00:00-03:00' })])
    renderizar()
    const selector = await abrirSelector(user)
    expect(casilla(selector)).toBeChecked()
    expect(within(selector).getByText('Seguirá vencido: el aviso saldrá enseguida.')).toBeInTheDocument()

    await user.click(manana(selector))

    // 10 -> 11 de noviembre = +1 día: 1/1/2020 pasa al 2/1/2020.
    await waitFor(() => expect(actualizarRecordatorio).toHaveBeenCalledWith(50, expect.objectContaining({ fechaHora: '2020-01-02T09:00:00-03:00' })))
  })

  it('dos clics seguidos en «Mañana» mandan un solo PATCH y un solo PUT', async () => {
    const user = userEvent.setup()
    renderizar()
    const selector = await abrirSelector(user)
    const boton = manana(selector)

    // Dentro de un mismo act React no llega a deshabilitar el botón entre un clic y otro: lo frena el guard del hook.
    act(() => {
      boton.click()
      boton.click()
    })

    await waitFor(() => expect(actualizarRecordatorio).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posponerTarea).toHaveBeenCalledTimes(1)
    expect(actualizarRecordatorio).toHaveBeenCalledTimes(1)
  })
})

describe('Posponer con recordatorio: Dejar sin fecha', () => {
  it('con uno pendiente lo dice en la ayuda y en el aviso, y NO toca el recordatorio', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const selector = await abrirSelector(user)
    expect(within(selector).getByText(/El recordatorio no se mueve\./)).toBeInTheDocument()

    await user.click(within(selector).getByRole('button', { name: 'Dejar sin fecha' }))

    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent('Sin fecha: la verás en el Cofre y en Recomendación; el recordatorio no se movió')
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it.each([
    ['sin recordatorio', [] as Recordatorio[]],
    ['con uno ya enviado', [recordatorio({ enviado: true })]],
  ])('%s: ni la ayuda ni el aviso hablan del recordatorio', async (_caso, lista) => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue(lista)
    renderizar()
    const selector = await abrirSelector(user)
    expect(within(selector).queryByText(/El recordatorio no se mueve/)).not.toBeInTheDocument()

    await user.click(within(selector).getByRole('button', { name: 'Dejar sin fecha' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/^Sin fecha: la verás en el Cofre y en Recomendación$/)
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
  })
})

describe('Posponer con recordatorio: errores y carga', () => {
  it.each([
    [404, 'Recordatorio no encontrado: 50'],
    [409, 'La tarea ya tiene un recordatorio'],
    [500, 'Error interno del servidor'],
  ])('si el PUT falla con %i, la tarea queda pospuesta y el aviso trae el mensaje del servidor', async (estado, mensaje) => {
    const user = userEvent.setup()
    vi.mocked(actualizarRecordatorio).mockRejectedValue(new ApiError(estado, mensaje))
    const { invalidar } = renderizar()
    const selector = await abrirSelector(user)

    await user.click(manana(selector))

    expect(await screen.findByRole('status')).toHaveTextContent(`Pospuesta al 11 de noviembre, pero no se pudo mover el recordatorio (${mensaje})`)
    expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
  })

  it('si el PATCH falla no se manda el PUT y el selector sigue abierto con el error', async () => {
    const user = userEvent.setup()
    vi.mocked(posponerTarea).mockRejectedValue(new ApiError(400, 'La nueva fecha debe ser posterior a la actual'))
    renderizar()
    const selector = await abrirSelector(user)

    await user.click(manana(selector))

    expect(await within(selector).findByRole('alert')).toHaveTextContent('La nueva fecha debe ser posterior a la actual')
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Posponer tarea' })).toBeInTheDocument()
  })

  it('si la consulta falla: nota, sin casilla, y se puede posponer sin mover', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockRejectedValue(new ApiError(500, 'Error interno'))
    renderizar()
    const selector = await abrirSelector(user)
    expect(await within(selector).findByText(/No se pudo consultar el recordatorio de esta tarea/)).toBeInTheDocument()
    expect(casilla(selector)).not.toBeInTheDocument()

    await user.click(manana(selector))

    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11'))
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
  })

  it('mientras la consulta carga, los botones esperan pero Cancelar sigue activo', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockReturnValue(new Promise(() => {}))
    renderizar()
    const selector = await abrirSelector(user, false)

    expect(manana(selector)).toBeDisabled()
    expect(within(selector).getByLabelText('Elegir fecha')).toBeDisabled()
    expect(within(selector).getByRole('button', { name: 'Dejar sin fecha' })).toBeDisabled()
    expect(within(selector).getByRole('button', { name: 'Cancelar' })).toBeEnabled()
  })

  it('una tarea sin fecha no muestra la casilla aunque tenga un recordatorio pendiente', async () => {
    // El menú no ofrece Posponer en tareas sin fecha: se monta el diálogo directo para fijar la guarda.
    const acciones = { posponer: { tarea: tarea({ fecha: null }), cancelar: vi.fn() }, pendiente: false, error: null, ejecutar: vi.fn() }
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PosponerDialog acciones={acciones as unknown as Acciones} hoy="2026-11-10" />
      </QueryClientProvider>,
    )
    const selector = await screen.findByRole('dialog', { name: 'Posponer tarea' })
    await waitFor(() => expect(getRecordatoriosDeTarea).toHaveBeenCalledWith(7))
    await waitFor(() => expect(within(selector).getByRole('button', { name: 'Dejar sin fecha' })).toBeEnabled())
    expect(casilla(selector)).not.toBeInTheDocument()
  })
})

describe('useAccionesTarea: guarda propia del recordatorio', () => {
  function montar() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    return renderHook(() => useAccionesTarea({ alMensaje: vi.fn(), alTerminar: vi.fn(), alSubtarea: vi.fn() }), { wrapper })
  }

  it('un recordatorio ya enviado que llega a ejecutar() se ignora: sin PUT', async () => {
    const { result } = montar()
    act(() => result.current.ejecutar('posponer', tarea({}), '2026-11-11', recordatorio({ enviado: true })))
    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7, '2026-11-11'))
    await waitFor(() => expect(result.current.pendiente).toBe(false))
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
  })

  it('un recordatorio pendiente sí se mueve', async () => {
    const { result } = montar()
    act(() => result.current.ejecutar('posponer', tarea({}), '2026-11-11', recordatorio()))
    await waitFor(() => expect(actualizarRecordatorio).toHaveBeenCalledTimes(1))
  })
})
