import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import type { Recordatorio } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'
import type { DestinoRecordatorio } from './recordatorioForm'
import { RecordatorioDialog } from './RecordatorioDialog'

vi.mock('@/api/recordatorios', () => ({
  getRecordatoriosDeTarea: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { actualizarRecordatorio, borrarRecordatorio, crearRecordatorio, getRecordatoriosDeTarea } from '@/api/recordatorios'

function recordatorio(parcial: Partial<Recordatorio> = {}): Recordatorio {
  return { id: 50, tareaId: 3, eventoId: null, fechaHora: '2026-11-12T10:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Aviso', ...parcial }
}

/** Lo que "tiene" el servidor: los mocks de escritura lo modifican, así el refresco muestra lo nuevo. */
let servidor: Recordatorio[]

function renderizar(destino: DestinoRecordatorio, existentes: Recordatorio[] = []) {
  servidor = existentes
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const alMensaje = vi.fn()
  const alCerrar = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <RecordatorioDialog destino={destino} alCerrar={alCerrar} alMensaje={alMensaje} />
    </QueryClientProvider>,
  )
  return { alMensaje, alCerrar }
}

const deTarea = (parcial: Partial<Tarea> = {}): DestinoRecordatorio => ({
  tipo: 'tarea',
  tarea: tarea({ id: 3, titulo: 'Embalar', fecha: '2026-11-12', ...parcial }),
})

const dialogoTarea = () => screen.findByRole('dialog', { name: 'Recordatorio de «Embalar»' })
const campoFecha = () => screen.getByLabelText('Fecha y hora')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getRecordatoriosDeTarea).mockImplementation(async (id) => servidor.filter((r) => r.tareaId === id))
  vi.mocked(crearRecordatorio).mockImplementation(async (req) => {
    const nuevo = recordatorio({ id: 77, ...req })
    servidor = [...servidor, nuevo]
    return nuevo
  })
  vi.mocked(actualizarRecordatorio).mockImplementation(async (id, req) => {
    const nuevo = recordatorio({ id, ...req })
    servidor = servidor.map((r) => (r.id === id ? nuevo : r))
    return nuevo
  })
  vi.mocked(borrarRecordatorio).mockImplementation(async (id) => {
    servidor = servidor.filter((r) => r.id !== id)
  })
})

describe('Recordatorio de una tarea', () => {
  it('sin recordatorio crea uno (POST con tareaId y canal APP), la descripción vacía es válida y avisa en su región status', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar(deTarea())
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    // La tarea solo tiene fecha: arranca ese día a las 09:00.
    expect(campoFecha()).toHaveValue('2026-11-12T09:00')
    await user.click(crear)
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith({
        tareaId: 3,
        eventoId: null,
        fechaHora: '2026-11-12T09:00:00-03:00',
        canal: 'APP',
        descripcion: '',
      }),
    )
    await waitFor(() => expect(within(d).getByRole('status')).toHaveTextContent('Recordatorio creado para el jue 12 nov · 09:00'))
    expect(alMensaje).toHaveBeenCalledWith('Recordatorio creado para el jue 12 nov · 09:00')
    // Ahora la tarea tiene uno: el diálogo ofrece editarlo, y sigue abierto.
    expect(await within(d).findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('con recordatorio abre en modo edición y el PUT reenvía los cinco campos', async () => {
    const user = userEvent.setup()
    renderizar(deTarea(), [recordatorio({ id: 50, descripcion: 'Llevar cinta', canal: 'CORREO' })])
    const d = await dialogoTarea()
    await within(d).findByRole('button', { name: 'Guardar cambios' })
    await waitFor(() => expect(campoFecha()).toBeEnabled())
    expect(campoFecha()).toHaveValue('2026-11-12T10:00')
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Llevar cinta')
    fireEvent.change(campoFecha(), { target: { value: '2026-11-12T16:30' } })
    await user.click(within(d).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(actualizarRecordatorio).toHaveBeenCalledWith(50, {
        tareaId: 3,
        eventoId: null,
        fechaHora: '2026-11-12T16:30:00-03:00',
        canal: 'CORREO',
        descripcion: 'Llevar cinta',
      }),
    )
    expect(crearRecordatorio).not.toHaveBeenCalled()
  })

  it('«Quitar» borra el recordatorio y el diálogo vuelve a ofrecer crear', async () => {
    const user = userEvent.setup()
    renderizar(deTarea(), [recordatorio({ id: 50 })])
    const d = await dialogoTarea()
    const quitar = await within(d).findByRole('button', { name: 'Quitar el recordatorio de «Embalar»' })
    await waitFor(() => expect(quitar).toBeEnabled())
    await user.click(quitar)
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(50))
    expect(await within(d).findByRole('button', { name: 'Crear recordatorio' })).toBeInTheDocument()
    expect(within(d).getByRole('status')).toHaveTextContent('Recordatorio quitado')
  })

  it('un doble clic en «Crear» manda una sola llamada', async () => {
    const user = userEvent.setup()
    renderizar(deTarea())
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    await user.dblClick(crear)
    await waitFor(() => expect(crearRecordatorio).toHaveBeenCalled())
    expect(crearRecordatorio).toHaveBeenCalledTimes(1)
  })

  it('409 al crear: muestra el mensaje del servidor, refresca y pasa a editar el que ya existía', async () => {
    const user = userEvent.setup()
    renderizar(deTarea())
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    // Otra pestaña lo creó mientras tanto.
    vi.mocked(crearRecordatorio).mockImplementation(async () => {
      servidor = [recordatorio({ id: 60, descripcion: 'De otra pestaña' })]
      throw new ApiError(409, 'La tarea 3 ya tiene un recordatorio')
    })
    await user.click(crear)
    expect(await within(d).findByRole('alert')).toHaveTextContent('La tarea 3 ya tiene un recordatorio')
    expect(await within(d).findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('De otra pestaña')
  })

  it('404 al guardar: muestra el mensaje, refresca y vuelve a ofrecer crear', async () => {
    const user = userEvent.setup()
    renderizar(deTarea(), [recordatorio({ id: 50 })])
    const d = await dialogoTarea()
    const guardar = await within(d).findByRole('button', { name: 'Guardar cambios' })
    await waitFor(() => expect(guardar).toBeEnabled())
    vi.mocked(actualizarRecordatorio).mockImplementation(async () => {
      servidor = []
      throw new ApiError(404, 'Recordatorio 50 no encontrado')
    })
    const consultas = vi.mocked(getRecordatoriosDeTarea).mock.calls.length
    await user.click(guardar)
    expect(await within(d).findByRole('alert')).toHaveTextContent('Recordatorio 50 no encontrado')
    expect(await within(d).findByRole('button', { name: 'Crear recordatorio' })).toBeInTheDocument()
    expect(vi.mocked(getRecordatoriosDeTarea).mock.calls.length).toBeGreaterThan(consultas)
  })

  it('500 al crear: el mensaje queda visible, el diálogo abierto y el botón activo para reintentar', async () => {
    const user = userEvent.setup()
    renderizar(deTarea())
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    vi.mocked(crearRecordatorio).mockRejectedValue(new ApiError(500, 'Error interno del servidor'))
    await user.click(crear)
    expect(await within(d).findByRole('alert')).toHaveTextContent('Error interno del servidor')
    expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeEnabled()
  })

  it('si la consulta del recordatorio falla, el formulario queda deshabilitado y no hay llamadas de escritura; «Reintentar» lo recupera', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockRejectedValueOnce(new ApiError(500, 'Error interno del servidor'))
    renderizar(deTarea())
    const d = await dialogoTarea()
    expect(await within(d).findByText('No se pudo consultar el recordatorio de esta tarea.')).toBeInTheDocument()
    expect(campoFecha()).toBeDisabled()
    expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeDisabled()
    await user.click(within(d).getByRole('button', { name: 'Crear recordatorio' }))
    expect(crearRecordatorio).not.toHaveBeenCalled()
    expect(actualizarRecordatorio).not.toHaveBeenCalled()
    expect(borrarRecordatorio).not.toHaveBeenCalled()

    await user.click(within(d).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(campoFecha()).toBeEnabled())
  })

  it('si la hora elegida ya pasó, avisa sin bloquear', async () => {
    const user = userEvent.setup()
    // Hoy es 10/11 a las 12:00: el 09:00 de hoy ya pasó.
    renderizar(deTarea({ fecha: '2026-11-10' }))
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    expect(within(d).getByText('Esa hora ya pasó: el aviso saldrá enseguida.')).toBeInTheDocument()
    await user.click(crear)
    await waitFor(() => expect(crearRecordatorio).toHaveBeenCalledTimes(1))
  })

  it('una hora futura no muestra la nota; sin fecha ni hora válidas no se llama al servidor', async () => {
    const user = userEvent.setup()
    renderizar(deTarea())
    const d = await dialogoTarea()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    expect(within(d).queryByText(/ya pasó/)).not.toBeInTheDocument()
    fireEvent.change(campoFecha(), { target: { value: '' } })
    await user.click(crear)
    expect(await within(d).findByRole('alert')).toHaveTextContent('Elige la fecha y la hora del aviso.')
    expect(crearRecordatorio).not.toHaveBeenCalled()
  })
})

describe('Recordatorio suelto', () => {
  it('sin descripción (vacía o solo espacios) no llama al servidor', async () => {
    const user = userEvent.setup()
    const { alCerrar } = renderizar({ tipo: 'suelto' })
    const d = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
    await user.click(within(d).getByRole('button', { name: 'Crear recordatorio' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent('Escribe una descripción')
    await user.type(screen.getByLabelText('Descripción (obligatoria)'), '   ')
    await user.click(within(d).getByRole('button', { name: 'Crear recordatorio' }))
    expect(crearRecordatorio).not.toHaveBeenCalled()
    expect(alCerrar).not.toHaveBeenCalled()
  })

  it('crea con tareaId y eventoId en null, arranca mañana a las 09:00 y se cierra', async () => {
    const user = userEvent.setup()
    const { alCerrar } = renderizar({ tipo: 'suelto' })
    const d = await screen.findByRole('dialog', { name: 'Nuevo recordatorio' })
    expect(campoFecha()).toHaveValue('2026-11-11T09:00')
    await user.type(screen.getByLabelText('Descripción (obligatoria)'), '  Llamar al médico ')
    await user.click(within(d).getByRole('button', { name: 'Crear recordatorio' }))
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith({
        tareaId: null,
        eventoId: null,
        fechaHora: '2026-11-11T09:00:00-03:00',
        canal: 'APP',
        descripcion: 'Llamar al médico',
      }),
    )
    await waitFor(() => expect(alCerrar).toHaveBeenCalled())
  })
})

describe('Editar o borrar una fila existente', () => {
  it.each([
    ['de una tarea', { tareaId: 8, eventoId: null }],
    ['de un evento', { tareaId: null, eventoId: 5 }],
  ])('editar un recordatorio %s conserva su tareaId y eventoId en el PUT', async (_, vinculo) => {
    const user = userEvent.setup()
    const { alCerrar } = renderizar({ tipo: 'existente', recordatorio: recordatorio({ id: 21, ...vinculo, descripcion: 'Original' }) })
    const d = await screen.findByRole('dialog', { name: 'Editar recordatorio' })
    expect(campoFecha()).toHaveValue('2026-11-12T10:00')
    fireEvent.change(campoFecha(), { target: { value: '2026-11-13T08:15' } })
    await user.click(within(d).getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(actualizarRecordatorio).toHaveBeenCalledWith(21, {
        ...vinculo,
        fechaHora: '2026-11-13T08:15:00-03:00',
        canal: 'APP',
        descripcion: 'Original',
      }),
    )
    await waitFor(() => expect(alCerrar).toHaveBeenCalled())
  })

  it('borrar pide confirmación: «Conservar» no llama; «Borrar recordatorio» hace el DELETE y cierra', async () => {
    const user = userEvent.setup()
    servidor = []
    const { alCerrar } = renderizar({ tipo: 'existente', recordatorio: recordatorio({ id: 21, tareaId: null, descripcion: 'Pagar la luz' }) })
    const d = await screen.findByRole('dialog', { name: 'Editar recordatorio' })
    await user.click(within(d).getByRole('button', { name: 'Borrar este recordatorio' }))
    expect(await screen.findByRole('dialog', { name: '¿Borrar este recordatorio?' })).toBeInTheDocument()
    expect(borrarRecordatorio).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Conservar' }))
    expect(await screen.findByRole('dialog', { name: 'Editar recordatorio' })).toBeInTheDocument()
    expect(borrarRecordatorio).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Borrar este recordatorio' }))
    await user.click(await screen.findByRole('button', { name: 'Borrar recordatorio' }))
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(21))
    await waitFor(() => expect(alCerrar).toHaveBeenCalled())
  })

  it('si el borrado falla, el mensaje del servidor queda en el diálogo de confirmación', async () => {
    const user = userEvent.setup()
    renderizar({ tipo: 'existente', recordatorio: recordatorio({ id: 21, tareaId: null }) })
    vi.mocked(borrarRecordatorio).mockRejectedValue(new ApiError(404, 'Recordatorio 21 no encontrado'))
    await user.click(await screen.findByRole('button', { name: 'Borrar este recordatorio' }))
    await user.click(await screen.findByRole('button', { name: 'Borrar recordatorio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Recordatorio 21 no encontrado')
    expect(screen.getByRole('button', { name: 'Borrar recordatorio' })).toBeEnabled()
  })
})
