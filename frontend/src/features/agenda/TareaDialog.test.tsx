import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({ getAgenda: vi.fn(), getTarea: vi.fn(), crearTarea: vi.fn(), actualizarTarea: vi.fn() }))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn().mockResolvedValue([]), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn().mockResolvedValue([]) }))
import { actualizarTarea, crearTarea, getAgenda, getTarea } from '@/api/tareas'

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

const TAREA_HECHA: Tarea = tarea({
  id: 7,
  titulo: 'Informe',
  descripcion: 'Detalle',
  estado: 'HECHO',
  prioridad: 'ALTA',
  horaInicio: '09:30:00',
  horaFin: '10:30:00',
  padreId: 3,
  proyectoId: 8,
})

function renderizar(agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [] }) {
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

async function abrirNueva(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nueva tarea' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(crearTarea).mockResolvedValue(tarea({ id: 99 }))
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({ id: 7 }))
})

describe('TareaDialog: validaciones', () => {
  it('el título es obligatorio', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument()
    expect(crearTarea).not.toHaveBeenCalled()
  })

  it('el título admite como máximo 200 caracteres', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.click(screen.getByLabelText('Título'))
    await user.paste('x'.repeat(201))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/como máximo 200/)).toBeInTheDocument()
    expect(crearTarea).not.toHaveBeenCalled()
  })

  it('las horas están deshabilitadas sin fecha y se habilitan con ella', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    expect(screen.getByLabelText('Hora de inicio')).toBeDisabled()
    expect(screen.getByLabelText('Hora de fin')).toBeDisabled()
    expect(screen.getByText('Sin fecha: se guarda en el cofre')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Fecha'), '2026-11-12')
    expect(screen.getByLabelText('Hora de inicio')).toBeEnabled()
    expect(screen.getByLabelText('Hora de fin')).toBeEnabled()
    expect(screen.queryByText('Sin fecha: se guarda en el cofre')).not.toBeInTheDocument()
  })

  it('la hora de fin debe ser posterior a la de inicio', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'A')
    await user.type(screen.getByLabelText('Fecha'), '2026-11-12')
    await user.type(screen.getByLabelText('Hora de inicio'), '10:00')
    await user.type(screen.getByLabelText('Hora de fin'), '09:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('La hora de fin debe ser posterior a la de inicio')).toBeInTheDocument()
    expect(crearTarea).not.toHaveBeenCalled()
  })

  it('si hay hora de fin debe haber de inicio', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'A')
    await user.type(screen.getByLabelText('Fecha'), '2026-11-12')
    await user.type(screen.getByLabelText('Hora de fin'), '09:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/indica también la de inicio/)).toBeInTheDocument()
    expect(crearTarea).not.toHaveBeenCalled()
  })
})

describe('TareaDialog: crear', () => {
  it('con fecha y horas envía el cuerpo exacto y confirma con la fecha', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'Pagar la luz')
    await user.type(screen.getByLabelText('Descripción'), 'Factura de noviembre')
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'MEDIA')
    await user.type(screen.getByLabelText('Fecha'), '2026-11-12')
    await user.type(screen.getByLabelText('Hora de inicio'), '08:00')
    await user.type(screen.getByLabelText('Hora de fin'), '09:30')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearTarea).toHaveBeenCalledTimes(1))
    expect(crearTarea).toHaveBeenCalledWith({
      titulo: 'Pagar la luz',
      descripcion: 'Factura de noviembre',
      prioridad: 'MEDIA',
      fecha: '2026-11-12',
      horaInicio: '08:00',
      horaFin: '09:30',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada para el 12 de noviembre')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
  })

  it('con fecha y sin horas', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'Llamar')
    await user.type(screen.getByLabelText('Fecha'), '2026-11-10')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(crearTarea).toHaveBeenCalled())
    expect(crearTarea).toHaveBeenCalledWith({
      titulo: 'Llamar',
      descripcion: null,
      prioridad: null,
      fecha: '2026-11-10',
      horaInicio: null,
      horaFin: null,
    })
  })

  it('sin fecha va al cofre: cuerpo con null y mensaje del cofre', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'Algún día')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(crearTarea).toHaveBeenCalled())
    expect(crearTarea).toHaveBeenCalledWith({
      titulo: 'Algún día',
      descripcion: null,
      prioridad: null,
      fecha: null,
      horaInicio: null,
      horaFin: null,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada en el cofre')
  })
})

describe('TareaDialog: editar', () => {
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [TAREA_HECHA], sinHora: [tarea({ id: 2, titulo: 'Comprar pan', prioridad: 'BAJA' })] }

  it('desde la lista del día abre el diálogo con los valores actuales', async () => {
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /^Comprar pan/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Comprar pan')
    expect(screen.getByLabelText('Prioridad')).toHaveValue('BAJA')
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-11-10')
  })

  it('desde un bloque de la planificación precarga también las horas', async () => {
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /Informe/ }))
    expect(screen.getByLabelText('Título')).toHaveValue('Informe')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Detalle')
    expect(screen.getByLabelText('Hora de inicio')).toHaveValue('09:30')
    expect(screen.getByLabelText('Hora de fin')).toHaveValue('10:30')
  })

  it('el PUT reenvía estado y padreId originales', async () => {
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /Informe/ }))
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Informe final')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(7, {
      titulo: 'Informe final',
      descripcion: 'Detalle',
      estado: 'HECHO',
      prioridad: 'ALTA',
      fecha: '2026-11-10',
      horaInicio: '09:30',
      horaFin: '10:30',
      padreId: 3,
    })
  })

  it('vaciar la fecha envía fecha y horas null (con estado y padreId originales)', async () => {
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /Informe/ }))
    await user.clear(screen.getByLabelText('Fecha'))
    expect(screen.getByLabelText('Hora de inicio')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ fecha: null, horaInicio: null, horaFin: null, estado: 'HECHO', padreId: 3 }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada en el cofre')
  })
})

describe('TareaDialog: subtareas', () => {
  const madre = tarea({ id: 3, titulo: 'Mudanza' })
  const subtarea = tarea({ id: 8, titulo: 'Embalar libros', padreId: 3 })
  async function abrirSubtarea(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Mudanza»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Agregar subtarea' }))
    return screen.findByRole('dialog')
  }

  it('el diálogo se titula "Nueva subtarea de «X»" y guardar manda padreId y avisa', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await abrirSubtarea(user)
    expect(screen.getByRole('heading', { name: 'Nueva subtarea de «Mudanza»' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha')).toHaveValue('')
    await user.type(screen.getByLabelText('Título'), 'Embalar libros')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearTarea).toHaveBeenCalledTimes(1))
    expect(crearTarea).toHaveBeenCalledWith({
      titulo: 'Embalar libros',
      descripcion: null,
      prioridad: null,
      fecha: null,
      horaInicio: null,
      horaFin: null,
      padreId: 3,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Subtarea agregada a «Mudanza»')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
  })

  it.each([
    [400, 'Los datos no son válidos: padre_id'],
    [404, 'No se encontró lo que buscabas.'],
    [409, 'La acción choca con el estado actual de los datos.'],
  ])('muestra el error %i al guardar la subtarea y no cierra el diálogo', async (status, mensaje) => {
    vi.mocked(crearTarea).mockRejectedValue(new ApiError(status, mensaje))
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await abrirSubtarea(user)
    await user.type(screen.getByLabelText('Título'), 'Paso')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('el diálogo de edición ofrece "Agregar subtarea" en una tarea abierta y lo reemplaza por la creación', async () => {
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await user.click(await screen.findByRole('button', { name: /^Mudanza/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar subtarea' }))
    expect(await screen.findByRole('heading', { name: 'Nueva subtarea de «Mudanza»' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Editar tarea' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it.each(['HECHO', 'CANCELADO'] as const)('el diálogo de edición de una tarea %s no ofrece "Agregar subtarea"', async (estado) => {
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [tarea({ id: 7, titulo: 'Informe', estado, horaInicio: '09:30:00', horaFin: '10:30:00' })], sinHora: [] })
    await user.click(await screen.findByRole('button', { name: /Informe/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar subtarea' })).not.toBeInTheDocument()
  })

  it('al editar una subtarea muestra "Subtarea de «X»" con el título de la madre', async () => {
    vi.mocked(getTarea).mockResolvedValue(madre)
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [subtarea] })
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    expect(await screen.findByText('Subtarea de «Mudanza»')).toBeInTheDocument()
    expect(getTarea).toHaveBeenCalledWith(3)
  })

  it('si la madre no carga, no muestra la línea y el diálogo funciona igual', async () => {
    vi.mocked(getTarea).mockRejectedValue(new ApiError(404, 'No se encontró lo que buscabas.'))
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [subtarea] })
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    await waitFor(() => expect(getTarea).toHaveBeenCalledWith(3))
    expect(screen.queryByText(/^Subtarea de/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Embalar libros')
  })

  it('una tarea sin madre no consulta getTarea ni muestra la línea', async () => {
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await user.click(await screen.findByRole('button', { name: /^Mudanza/ }))
    await screen.findByRole('heading', { name: 'Editar tarea' })
    expect(getTarea).not.toHaveBeenCalled()
    expect(screen.queryByText(/^Subtarea de/)).not.toBeInTheDocument()
  })
})

describe('TareaDialog: errores y estado pendiente', () => {
  it.each([
    [400, 'Los datos no son válidos: hora_fin debe ser posterior a hora_inicio'],
    [409, 'La acción choca con el estado actual de los datos.'],
  ])('muestra el error %i del backend en el diálogo y no lo cierra', async (status, mensaje) => {
    vi.mocked(crearTarea).mockRejectedValue(new ApiError(status, mensaje))
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'A')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(dialogo).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('deshabilita Guardar mientras la mutación está pendiente', async () => {
    let resolver: (t: Tarea) => void = () => {}
    vi.mocked(crearTarea).mockReturnValue(new Promise<Tarea>((r) => (resolver = r)))
    const user = userEvent.setup()
    renderizar()
    await abrirNueva(user)
    await user.type(screen.getByLabelText('Título'), 'A')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    resolver(tarea({ id: 99 }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
