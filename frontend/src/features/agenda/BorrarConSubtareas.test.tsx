import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({
  getAgenda: vi.fn(),
  getTarea: vi.fn(),
  getTareas: vi.fn(),
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
}))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatorios: vi.fn(),
  getRecordatoriosDeTarea: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { getEventos } from '@/api/eventos'
import { getRecordatorios } from '@/api/recordatorios'
import { borrarTarea, getAgenda, getTareas } from '@/api/tareas'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 1,
    titulo: 'Tarea',
    descripcion: null,
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

const MADRE = tarea({ id: 7, titulo: 'Madre' })
/** Madre (7) con dos hijas directas y una nieta: 3 subtareas en total. */
const CON_SUBTAREAS = [
  MADRE,
  tarea({ id: 8, titulo: 'Hija A', padreId: 7 }),
  tarea({ id: 9, titulo: 'Hija B', padreId: 7 }),
  tarea({ id: 10, titulo: 'Nieta', padreId: 8 }),
]

function renderizar(sinHora: Tarea[] = [MADRE], precargar?: Tarea[], conHora: Tarea[] = []) {
  const agenda: Agenda = { fecha: '2026-11-10', conHora, sinHora }
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (precargar) queryClient.setQueryData(['tareas', 'todas'], precargar)
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
  return { invalidar }
}

type Usuario = ReturnType<typeof userEvent.setup>

async function abrirDialogoBorrar(user: Usuario, titulo = 'Madre') {
  await user.click(await screen.findByRole('button', { name: `Acciones de «${titulo}»` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }))
  return screen.findByRole('dialog', { name: 'Borrar tarea' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(borrarTarea).mockResolvedValue(undefined)
  vi.mocked(getTareas).mockResolvedValue(CON_SUBTAREAS)
})

describe('Borrar con subtareas', () => {
  it('sin subtareas el diálogo es el de siempre y borra sin modo', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockResolvedValue([MADRE])
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    const boton = within(dialogo).getByRole('button', { name: 'Borrar' })
    await waitFor(() => expect(boton).toBeEnabled())
    expect(dialogo).toHaveTextContent('¿Borrar «Madre»?')
    expect(within(dialogo).queryByRole('radio')).not.toBeInTheDocument()
    await user.click(boton)
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7, undefined))
    expect(await screen.findByRole('status')).toHaveTextContent('«Madre» borrada')
  })

  it('con subtareas muestra el conteo total y dos opciones con "conservar" marcada', async () => {
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    expect(await within(dialogo).findByText('«Madre» tiene 3 subtareas.')).toBeInTheDocument()
    const grupo = within(dialogo).getByRole('group', { name: '¿Qué hacemos con las subtareas?' })
    expect(within(grupo).getAllByRole('radio')).toHaveLength(2)
    expect(within(grupo).getByRole('radio', { name: /Conservar las subtareas/ })).toBeChecked()
    expect(within(grupo).getByRole('radio', { name: /Borrar también las subtareas/ })).not.toBeChecked()
    expect(within(dialogo).getByText('Quedan como tareas sueltas, sin madre.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Borrar solo la tarea' })).toBeEnabled()
  })

  it('si la tarea tiene madre, la ayuda dice de quién pasan a colgar', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ id: 8, titulo: 'Hija A', padreId: 7 })])
    const dialogo = await abrirDialogoBorrar(user, 'Hija A')
    expect(await within(dialogo).findByText('«Hija A» tiene 1 subtarea.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Pasan a colgar de «Madre».')).toBeInTheDocument()
  })

  it('confirmar "conservar" manda ese modo, avisa e invalida agenda, tareas y recordatorios', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    await user.click(await within(dialogo).findByRole('button', { name: 'Borrar solo la tarea' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7, 'conservar'))
    expect(await screen.findByRole('status')).toHaveTextContent('«Madre» borrada; sus 3 subtareas se conservaron')
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] }))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('elegir "borrar" cambia la etiqueta, manda ese modo e invalida recordatorios', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    await user.click(await within(dialogo).findByRole('radio', { name: /Borrar también las subtareas/ }))
    expect(within(dialogo).getByText('Se borran las 3 subtareas y sus recordatorios. No se puede deshacer.')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar la tarea y 3 subtareas' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7, 'borrar'))
    expect(await screen.findByRole('status')).toHaveTextContent('«Madre» borrada con 3 subtareas')
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] }))
  })

  it('la ayuda de borrar va en singular con una sola subtarea', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockResolvedValue([MADRE, tarea({ id: 8, titulo: 'Hija A', padreId: 7 })])
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    await user.click(await within(dialogo).findByRole('radio', { name: /Borrar también las subtareas/ }))
    expect(within(dialogo).getByText('Se borra la subtarea y sus recordatorios. No se puede deshacer.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Borrar la tarea y 1 subtarea' })).toBeInTheDocument()
  })

  it('mientras carga la lista avisa "Comprobando subtareas…" y no deja confirmar', async () => {
    const user = userEvent.setup()
    let resolver: (t: Tarea[]) => void = () => {}
    vi.mocked(getTareas).mockReturnValue(new Promise((r) => (resolver = r)))
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Comprobando subtareas…')
    expect(within(dialogo).getByRole('button', { name: 'Borrar' })).toBeDisabled()
    resolver(CON_SUBTAREAS)
    expect(await within(dialogo).findByRole('button', { name: 'Borrar solo la tarea' })).toBeEnabled()
    expect(within(dialogo).queryByText('Comprobando subtareas…')).not.toBeInTheDocument()
  })

  it('con datos en caché igual espera a que termine la consulta (isFetching) antes de dejar confirmar', async () => {
    const user = userEvent.setup()
    let resolver: (t: Tarea[]) => void = () => {}
    vi.mocked(getTareas).mockReturnValue(new Promise((r) => (resolver = r)))
    renderizar([MADRE], CON_SUBTAREAS)
    const dialogo = await abrirDialogoBorrar(user)
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Comprobando subtareas…')
    expect(within(dialogo).getByRole('button', { name: 'Borrar' })).toBeDisabled()
    resolver(CON_SUBTAREAS)
    expect(await within(dialogo).findByRole('button', { name: 'Borrar solo la tarea' })).toBeEnabled()
  })

  it('si falla la carga cae al diálogo simple', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    const boton = within(dialogo).getByRole('button', { name: 'Borrar' })
    await waitFor(() => expect(boton).toBeEnabled())
    expect(within(dialogo).queryByRole('radio')).not.toBeInTheDocument()
    await user.click(boton)
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7, undefined))
  })

  it('un error del servidor queda visible y el diálogo abierto', async () => {
    const user = userEvent.setup()
    vi.mocked(borrarTarea).mockRejectedValue(new ApiError(404, 'No existe la tarea «Madre»'))
    renderizar()
    const dialogo = await abrirDialogoBorrar(user)
    await user.click(await within(dialogo).findByRole('button', { name: 'Borrar solo la tarea' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No existe la tarea «Madre»')
    expect(screen.getByRole('dialog', { name: 'Borrar tarea' })).toBeInTheDocument()
  })

  it('caché vieja con 0 subtareas: el 409 refresca la lista y el diálogo ofrece las dos opciones', async () => {
    const user = userEvent.setup()
    vi.mocked(getTareas).mockResolvedValueOnce([MADRE]).mockResolvedValue(CON_SUBTAREAS)
    vi.mocked(borrarTarea).mockRejectedValueOnce(new ApiError(409, '«Madre» tiene subtareas: indica si quieres borrarlas o conservarlas'))
    renderizar([MADRE], [MADRE])
    const dialogo = await abrirDialogoBorrar(user)
    const simple = within(dialogo).getByRole('button', { name: 'Borrar' })
    await waitFor(() => expect(simple).toBeEnabled())
    await user.click(simple)
    expect(borrarTarea).toHaveBeenCalledWith(7, undefined)
    expect(await within(dialogo).findByRole('radio', { name: /Conservar las subtareas/ })).toBeChecked()
    expect(getTareas).toHaveBeenCalledTimes(2)
    // El error sigue a la vista junto a las opciones.
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('«Madre» tiene subtareas')
  })

  it('la opción vuelve a "conservar" al reabrir el diálogo', async () => {
    const user = userEvent.setup()
    renderizar()
    let dialogo = await abrirDialogoBorrar(user)
    await user.click(await within(dialogo).findByRole('radio', { name: /Borrar también las subtareas/ }))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    dialogo = await abrirDialogoBorrar(user)
    expect(await within(dialogo).findByRole('radio', { name: /Conservar las subtareas/ })).toBeChecked()
  })

  it('desde el diálogo de edición también ofrece las opciones', async () => {
    const user = userEvent.setup()
    renderizar([], undefined, [tarea({ id: 7, titulo: 'Madre', horaInicio: '09:30:00', horaFin: '10:30:00' })])
    await user.click(await screen.findByRole('button', { name: /Madre/ }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Editar tarea' })).getByRole('button', { name: 'Borrar' }))
    const confirmar = await screen.findByRole('dialog', { name: 'Borrar tarea' })
    await user.click(await within(confirmar).findByRole('radio', { name: /Borrar también las subtareas/ }))
    await user.click(within(confirmar).getByRole('button', { name: 'Borrar la tarea y 3 subtareas' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7, 'borrar'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
