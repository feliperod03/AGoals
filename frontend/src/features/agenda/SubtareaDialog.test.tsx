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
  crearTarea: vi.fn(),
  actualizarTarea: vi.fn(),
  getTareas: vi.fn(),
  marcarHecha: vi.fn(),
  reabrirTarea: vi.fn(),
  posponerTarea: vi.fn(),
  borrarTarea: vi.fn(),
}))
vi.mock('@/api/eventos', () => ({ getEventos: vi.fn(), getEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatorios: vi.fn(), getRecordatoriosDeTarea: vi.fn(), borrarRecordatorio: vi.fn() }))
import { getEventos } from '@/api/eventos'
import { getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, getAgenda, getTareas } from '@/api/tareas'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 1,
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
    ...parcial,
  }
}

const MADRE = tarea({ id: 1, titulo: 'Mudanza' })
const ELEGIDA = tarea({
  id: 20,
  titulo: 'Embalar cocina',
  descripcion: 'Cajas chicas',
  prioridad: 'ALTA',
  estado: 'EN_PROGRESO',
  fecha: '2026-11-12',
  horaInicio: '09:00:00',
  horaFin: '10:30:00',
  padreId: 30,
})
const TODAS = [MADRE, ELEGIDA, tarea({ id: 30, titulo: 'Casa nueva', fecha: null }), tarea({ id: 21, titulo: 'Acción urgente', fecha: null })]

type Usuario = ReturnType<typeof userEvent.setup>

function renderizar() {
  const agenda: Agenda = { fecha: '2026-11-10', conHora: [], sinHora: [MADRE] }
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

async function abrirEleccion(user: Usuario) {
  await user.click(await screen.findByRole('button', { name: 'Acciones de «Mudanza»' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Agregar subtarea' }))
  return screen.findByRole('dialog', { name: 'Agregar subtarea a «Mudanza»' })
}

async function abrirVincular(user: Usuario) {
  const dialogo = await abrirEleccion(user)
  const boton = within(dialogo).getByRole('button', { name: 'Vincular una existente' })
  await waitFor(() => expect(boton).toBeEnabled())
  await user.click(boton)
  return dialogo
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
  vi.mocked(getTareas).mockResolvedValue(TODAS)
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({ id: 20 }))
})

describe('SubtareaDialog', () => {
  it('ofrece los dos caminos y el foco inicial va a "Crear una nueva"', async () => {
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirEleccion(user)
    expect(within(dialogo).getByRole('button', { name: 'Vincular una existente' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Crear una nueva' })).toHaveFocus())
  })

  it('"Crear una nueva" abre el flujo de 8.2d', async () => {
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirEleccion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Crear una nueva' }))
    expect(await screen.findByRole('heading', { name: 'Nueva subtarea de «Mudanza»' })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('"Vincular" lista candidatas sin la madre y filtra por título sin tildes', async () => {
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirVincular(user)
    expect(within(dialogo).getByRole('button', { name: /Embalar cocina/ })).toHaveTextContent('Ahora es subtarea de «Casa nueva»; se moverá')
    expect(within(dialogo).queryByRole('button', { name: /^Mudanza/ })).not.toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Buscar tarea'), 'ACCION')
    expect(within(dialogo).getByRole('button', { name: /Acción urgente/ })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: /Embalar cocina/ })).not.toBeInTheDocument()
  })

  it('elegir una manda el PUT con todos sus campos y padreId = X, invalida y avisa', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar()
    const dialogo = await abrirVincular(user)
    await user.click(within(dialogo).getByRole('button', { name: /Embalar cocina/ }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledTimes(1))
    expect(actualizarTarea).toHaveBeenCalledWith(20, {
      titulo: 'Embalar cocina',
      descripcion: 'Cajas chicas',
      estado: 'EN_PROGRESO',
      prioridad: 'ALTA',
      fecha: '2026-11-12',
      horaInicio: '09:00',
      horaFin: '10:30',
      padreId: 1,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('«Embalar cocina» ahora es subtarea de «Mudanza»')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
  })

  it('con la lista cargando, solo "Vincular" queda deshabilitado', async () => {
    vi.mocked(getTareas).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirEleccion(user)
    expect(within(dialogo).getByRole('button', { name: 'Vincular una existente' })).toBeDisabled()
    expect(within(dialogo).getByText('Cargando tareas…')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Crear una nueva' })).toBeEnabled()
  })

  it('con la lista fallida, solo "Vincular" queda deshabilitado y "Crear" sigue funcionando', async () => {
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirEleccion(user)
    expect(await within(dialogo).findByText('No se pudo cargar la lista de tareas')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Vincular una existente' })).toBeDisabled()
    await user.click(within(dialogo).getByRole('button', { name: 'Crear una nueva' }))
    expect(await screen.findByRole('heading', { name: 'Nueva subtarea de «Mudanza»' })).toBeInTheDocument()
  })

  it('un 400 se ve con role="alert" y el diálogo sigue abierto', async () => {
    vi.mocked(actualizarTarea).mockRejectedValue(new ApiError(400, 'Eso crearía un ciclo'))
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirVincular(user)
    await user.click(within(dialogo).getByRole('button', { name: /Embalar cocina/ }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Eso crearía un ciclo')
    expect(screen.getByRole('dialog', { name: 'Agregar subtarea a «Mudanza»' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /Embalar cocina/ })).toBeEnabled()
  })

  it('durante la mutación no se puede elegir otra ni cerrar con Escape', async () => {
    let resolver: (t: Tarea) => void = () => {}
    vi.mocked(actualizarTarea).mockReturnValue(new Promise<Tarea>((r) => (resolver = r)))
    const user = userEvent.setup()
    renderizar()
    const dialogo = await abrirVincular(user)
    await user.click(within(dialogo).getByRole('button', { name: /Embalar cocina/ }))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: /Acción urgente/ })).toBeDisabled())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Agregar subtarea a «Mudanza»' })).toBeInTheDocument()
    expect(actualizarTarea).toHaveBeenCalledTimes(1)
    resolver(tarea({ id: 20 }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Escape cierra el diálogo entero', async () => {
    const user = userEvent.setup()
    renderizar()
    await abrirVincular(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(actualizarTarea).not.toHaveBeenCalled()
  })

  it('desde el diálogo de edición se abre encima y cancelar conserva la edición', async () => {
    const user = userEvent.setup()
    renderizar()
    await user.click(await screen.findByRole('button', { name: /^Mudanza/ }))
    expect(await screen.findByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar subtarea' }))
    expect(await screen.findByRole('heading', { name: 'Agregar subtarea a «Mudanza»' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Agregar subtarea a «Mudanza»' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Editar tarea' })).toBeInTheDocument()
  })
})
