import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({ getAgenda: vi.fn(), getTarea: vi.fn(), getTareas: vi.fn(), crearTarea: vi.fn(), actualizarTarea: vi.fn() }))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn().mockResolvedValue([]), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn().mockResolvedValue([]) }))
import { actualizarTarea, crearTarea, getAgenda, getTarea, getTareas } from '@/api/tareas'

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
  vi.mocked(getTareas).mockResolvedValue([])
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
    await user.click(await screen.findByRole('button', { name: 'Crear una nueva' }))
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
    await user.click(await screen.findByRole('button', { name: 'Crear una nueva' }))
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

  it('al editar una subtarea el campo Madre muestra el título de la madre (y ya no hay línea "Subtarea de")', async () => {
    vi.mocked(getTarea).mockResolvedValue(madre)
    vi.mocked(getTareas).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [subtarea] })
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    await waitFor(() => expect(screen.getByTestId('madre-actual')).toHaveTextContent('«Mudanza»'))
    expect(getTarea).toHaveBeenCalledWith(3)
    expect(screen.queryByText(/^Subtarea de/)).not.toBeInTheDocument()
  })

  it('si la madre no carga, el campo muestra "Tarea n.º 3" y el diálogo funciona igual', async () => {
    vi.mocked(getTarea).mockRejectedValue(new ApiError(404, 'No se encontró lo que buscabas.'))
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [subtarea] })
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    await waitFor(() => expect(getTarea).toHaveBeenCalledWith(3))
    expect(screen.getByTestId('madre-actual')).toHaveTextContent('Tarea n.º 3')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Embalar libros')
  })

  it('una tarea sin madre no consulta getTarea y el campo dice "Sin madre"', async () => {
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await user.click(await screen.findByRole('button', { name: /^Mudanza/ }))
    await screen.findByRole('heading', { name: 'Editar tarea' })
    expect(getTarea).not.toHaveBeenCalled()
    expect(screen.getByTestId('madre-actual')).toHaveTextContent('Sin madre')
  })

  it('al crear (con o sin madre fijada) no hay selector de madre ni se pide la lista', async () => {
    const user = userEvent.setup()
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await user.click(await screen.findByRole('button', { name: 'Nueva tarea' }))
    expect(screen.queryByTestId('madre-actual')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await abrirSubtarea(user)
    // Con la madre fijada, el título del diálogo sigue diciendo de quién es la subtarea.
    expect(screen.getByRole('heading', { name: 'Nueva subtarea de «Mudanza»' })).toBeInTheDocument()
    expect(screen.queryByTestId('madre-actual')).not.toBeInTheDocument()
    // La única consulta es la del diálogo de elección (8.2g); el formulario de creación no pide otra.
    expect(getTareas).toHaveBeenCalledTimes(1)
  })
})

describe('TareaDialog: cambiar la madre', () => {
  const madre = tarea({ id: 3, titulo: 'Mudanza' })
  const hija = tarea({ id: 8, titulo: 'Embalar libros', padreId: 3 })
  const nieta = tarea({ id: 9, titulo: 'Cajas de cartón', padreId: 8 })
  const otra = tarea({ id: 4, titulo: 'Árbol genealógico', fecha: null })
  const cerrada = tarea({ id: 5, titulo: 'Vieja', estado: 'HECHO' })
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [hija] }

  async function abrir(user: ReturnType<typeof userEvent.setup>, lista: Tarea[] = [madre, hija, nieta, otra, cerrada]) {
    vi.mocked(getTarea).mockResolvedValue(madre)
    vi.mocked(getTareas).mockResolvedValue(lista)
    const { invalidar } = renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar' })).toBeEnabled())
    return invalidar
  }

  it('muestra la madre actual', async () => {
    await abrir(userEvent.setup())
    expect(screen.getByTestId('madre-actual')).toHaveTextContent('«Mudanza»')
  })

  it('elegir otra madre y guardar manda su id y avisa', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('button', { name: /^Árbol genealógico/ }))
    expect(screen.getByTestId('madre-actual')).toHaveTextContent('«Árbol genealógico»')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: 4, estado: 'PENDIENTE' }))
    expect(await screen.findByRole('status')).toHaveTextContent('«Embalar libros» ahora es subtarea de «Árbol genealógico»')
  })

  it('"Sin madre" manda padreId null y avisa', async () => {
    const user = userEvent.setup()
    const invalidar = await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('button', { name: /^Sin madre/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: null }))
    expect(await screen.findByRole('status')).toHaveTextContent('«Embalar libros» ya no es subtarea')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
  })

  it('sin tocar el campo reenvía el padreId original y el aviso de siempre', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: 3 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada para el 10 de noviembre')
  })

  it('elegir la misma madre de siempre no cuenta como cambio', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('button', { name: /^Mudanza/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: 3 }))
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada para el 10 de noviembre')
  })

  it('la lista no ofrece la propia tarea, sus descendientes ni cerradas ajenas, y marca la madre actual', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    const lista = screen.getByRole('list')
    const nombres = within(lista).getAllByRole('button').map((b) => b.textContent)
    expect(nombres).toEqual([
      'Sin madre',
      'Árbol genealógicoTarea principal · sin fecha',
      'MudanzaTarea principal · 10 de noviembre (actual)',
    ])
    expect(within(lista).getByRole('button', { name: /^Mudanza/ })).toHaveAttribute('aria-current', 'true')
    expect(within(lista).getByRole('button', { name: /^Sin madre/ })).not.toHaveAttribute('aria-current')
  })

  it('una tarea sin madre tiene "Sin madre" marcada como actual', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockResolvedValue([madre, otra])
    renderizar({ fecha: '2026-11-10', conHora: [], sinHora: [madre] })
    await user.click(await screen.findByRole('button', { name: /^Mudanza/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByRole('button', { name: /^Sin madre/ })).toHaveAttribute('aria-current', 'true')
  })

  it('la madre actual sigue en la lista aunque esté cerrada', async () => {
    const user = userEvent.setup()
    vi.mocked(getTarea).mockResolvedValue({ ...madre, estado: 'HECHO' })
    await abrir(user, [{ ...madre, estado: 'HECHO' }, hija, otra])
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByRole('button', { name: /^Mudanza/ })).toHaveAttribute('aria-current', 'true')
  })

  it('con la lista cargando el campo está deshabilitado, muestra la madre y el PUT conserva el padreId', async () => {
    vi.mocked(getTarea).mockResolvedValue(madre)
    vi.mocked(getTareas).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeDisabled()
    await waitFor(() => expect(screen.getByTestId('madre-actual')).toHaveTextContent('«Mudanza»'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: 3 }))
  })

  it('si la lista falla el campo queda deshabilitado con aviso y el PUT conserva el padreId', async () => {
    vi.mocked(getTarea).mockResolvedValue(madre)
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const user = userEvent.setup()
    renderizar(agenda)
    await user.click(await screen.findByRole('button', { name: /^Embalar libros/ }))
    expect(await screen.findByText('No se pudo cargar la lista de tareas; la madre se conserva.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(8, expect.objectContaining({ padreId: 3 }))
  })

  it('un error 400 del servidor (ciclo) se ve con el diálogo abierto', async () => {
    vi.mocked(actualizarTarea).mockRejectedValue(new ApiError(400, 'Los datos no son válidos: padre_id'))
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.click(screen.getByRole('button', { name: /^Árbol genealógico/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Los datos no son válidos: padre_id')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('la búsqueda ignora tildes y mayúsculas; Enter no envía el formulario y elige si hay una sola coincidencia', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.type(screen.getByLabelText('Buscar madre'), 'ARBOL')
    expect(within(screen.getByRole('list')).queryByRole('button', { name: /^Mudanza/ })).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(actualizarTarea).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar madre')).not.toBeInTheDocument()
    expect(screen.getByTestId('madre-actual')).toHaveTextContent('«Árbol genealógico»')
  })

  it('sin coincidencias avisa', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.type(screen.getByLabelText('Buscar madre'), 'zzz')
    expect(screen.getByText('Ninguna tarea coincide.')).toBeInTheDocument()
  })

  it('títulos repetidos se distinguen por el detalle', async () => {
    const user = userEvent.setup()
    const a = tarea({ id: 20, titulo: 'Comprar', fecha: '2026-11-12' })
    const b = tarea({ id: 21, titulo: 'Comprar', padreId: 3, fecha: null })
    await abrir(user, [madre, hija, a, b])
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByRole('button', { name: 'ComprarTarea principal · 12 de noviembre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ComprarSubtarea de «Mudanza» · sin fecha' })).toBeInTheDocument()
  })

  it('Escape con la lista abierta cierra solo la lista: el diálogo sigue y conserva lo escrito', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Cambiado')
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(screen.getByLabelText('Buscar madre')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Buscar madre')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Cambiado')
    expect(screen.getByRole('button', { name: 'Cambiar' })).toHaveFocus()
    // Con la lista cerrada, Escape vuelve a cerrar el diálogo.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Escape también cierra solo la lista si el foco está en una de sus opciones', async () => {
    const user = userEvent.setup()
    await abrir(user)
    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    await user.tab()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Buscar madre')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
