import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Recordatorio } from '@/types/recordatorio'
import type { Agenda, Tarea } from '@/types/tarea'
import { HoyPage } from './HoyPage'

vi.mock('@/api/tareas', () => ({
  getAgenda: vi.fn(),
  getTarea: vi.fn(),
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
import { borrarRecordatorio, getRecordatorios, getRecordatoriosDeTarea } from '@/api/recordatorios'
import { actualizarTarea, borrarTarea, getAgenda, marcarHecha, posponerTarea, reabrirTarea } from '@/api/tareas'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 1,
    titulo: 'Tarea',
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

function recordatorio(parcial: Partial<Recordatorio>): Recordatorio {
  return { id: 50, tareaId: 1, eventoId: null, fechaHora: '2026-11-11T09:00:00-03:00', enviado: false, descripcion: 'Aviso', ...parcial }
}

function renderizar(sinHora: Tarea[], conHora: Tarea[] = []) {
  const agenda: Agenda = { fecha: '2026-11-10', conHora, sinHora }
  vi.mocked(getAgenda).mockResolvedValue(agenda)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <HoyPage />
    </QueryClientProvider>,
  )
  return { invalidar, container }
}

type Usuario = ReturnType<typeof userEvent.setup>

async function abrirMenu(user: Usuario, titulo: string) {
  await user.click(await screen.findByRole('button', { name: `Acciones de «${titulo}»` }))
  return screen.findByRole('menu')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(getEventos).mockResolvedValue([])
  vi.mocked(getRecordatorios).mockResolvedValue([])
  vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([])
  vi.mocked(borrarRecordatorio).mockResolvedValue(undefined)
  vi.mocked(borrarTarea).mockResolvedValue(undefined)
  vi.mocked(marcarHecha).mockResolvedValue(tarea({ estado: 'HECHO' }))
  vi.mocked(reabrirTarea).mockResolvedValue(tarea({}))
  vi.mocked(posponerTarea).mockResolvedValue(tarea({ fecha: '2026-11-11' }))
  vi.mocked(actualizarTarea).mockResolvedValue(tarea({}))
})

describe('Acciones: estructura accesible de la fila', () => {
  it('los tres controles son botones hermanos (ninguno dentro de otro) con nombre accesible', async () => {
    const { container } = renderizar([tarea({ id: 1, titulo: 'Comprar pan' })])
    await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' })
    expect(container.querySelectorAll('button button')).toHaveLength(0)
    const fila = screen.getByRole('listitem')
    expect(within(fila).getAllByRole('button')).toHaveLength(3)
    expect(within(fila).getByRole('button', { name: /^Comprar pan/ })).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Acciones de «Comprar pan»' })).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('una tarea hecha ofrece Reabrir y una cancelada tiene el estado deshabilitado', async () => {
    renderizar([tarea({ id: 1, titulo: 'A', estado: 'HECHO' }), tarea({ id: 2, titulo: 'B', estado: 'CANCELADO' })])
    expect(await screen.findByRole('button', { name: 'Reabrir «A»' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '«B» está cancelada' })).toBeDisabled()
  })
})

describe('Acciones: menú (Radix)', () => {
  it('se abre con el teclado, navega con las flechas y Escape devuelve el foco al botón', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ titulo: 'Comprar pan' })])
    const boton = await screen.findByRole('button', { name: 'Acciones de «Comprar pan»' })
    boton.focus()
    await user.keyboard('{Enter}')
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Posponer', 'Cancelar', 'Borrar'])
    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(boton).toHaveFocus()
  })

  it('según el estado ofrece Posponer, Cancelar o Reactivar', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ id: 1, titulo: 'A', estado: 'HECHO' }), tarea({ id: 2, titulo: 'B', estado: 'CANCELADO' })])
    let menu = await abrirMenu(user, 'A')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Cancelar', 'Borrar'])
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    menu = await abrirMenu(user, 'B')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Reactivar', 'Borrar'])
  })
})

describe('Acciones: peticiones y mensajes', () => {
  it('marcar hecha manda PATCH /hecha, invalida y confirma', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))
    await waitFor(() => expect(marcarHecha).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Marcada como hecha')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
  })

  it('reabrir manda PATCH /reabrir', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ id: 7, titulo: 'Comprar pan', estado: 'HECHO' })])
    await user.click(await screen.findByRole('button', { name: 'Reabrir «Comprar pan»' }))
    await waitFor(() => expect(reabrirTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Reabierta')
  })

  it('posponer manda PATCH /posponer y el mensaje usa la fecha que devuelve el backend', async () => {
    const user = userEvent.setup()
    vi.mocked(posponerTarea).mockResolvedValue(tarea({ id: 7, fecha: '2026-11-11' }))
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Posponer' }))
    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Pospuesta al 11 de noviembre')
  })

  it('cancelar manda un PUT con estado CANCELADO y el resto de los campos', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ id: 7, titulo: 'Comprar pan', prioridad: 'ALTA', padreId: 3 })])
    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalled())
    expect(actualizarTarea).toHaveBeenCalledWith(7, {
      titulo: 'Comprar pan',
      descripcion: 'Detalle',
      estado: 'CANCELADO',
      prioridad: 'ALTA',
      fecha: '2026-11-10',
      horaInicio: null,
      horaFin: null,
      padreId: 3,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Tarea cancelada')
  })

  it('reactivar manda un PUT con estado PENDIENTE y confirma', async () => {
    const user = userEvent.setup()
    renderizar([tarea({ id: 7, titulo: 'Comprar pan', estado: 'CANCELADO' })])
    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Reactivar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(7, expect.objectContaining({ estado: 'PENDIENTE', titulo: 'Comprar pan' })))
    expect(await screen.findByRole('status')).toHaveTextContent('Reactivada')
  })

  it('un 409 al marcar hecha se muestra legible', async () => {
    const user = userEvent.setup()
    vi.mocked(marcarHecha).mockRejectedValue(new ApiError(409, 'No se puede marcar como hecha una tarea cancelada: 7'))
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede marcar como hecha una tarea cancelada')
  })

  it('deshabilita los botones mientras la acción está pendiente', async () => {
    const user = userEvent.setup()
    let resolver: (t: Tarea) => void = () => {}
    vi.mocked(marcarHecha).mockReturnValue(new Promise<Tarea>((r) => (resolver = r)))
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar «Comprar pan» como hecha' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Acciones de «Comprar pan»' })).toBeDisabled()
    resolver(tarea({ estado: 'HECHO' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones de «Comprar pan»' })).toBeEnabled())
  })
})

describe('Acciones: borrar', () => {
  it('pide confirmación: cancelar no borra y confirmar manda DELETE', async () => {
    const user = userEvent.setup()
    const { invalidar } = renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Borrar tarea' })
    expect(dialogo).toHaveTextContent('¿Borrar «Comprar pan»?')
    expect(borrarTarea).not.toHaveBeenCalled()

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(borrarTarea).not.toHaveBeenCalled()

    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Borrar tarea' })).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Tarea borrada')
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('un 409 por subtareas se muestra en el diálogo y este sigue abierto', async () => {
    const user = userEvent.setup()
    vi.mocked(borrarTarea).mockRejectedValue(new ApiError(409, 'La tarea 7 tiene subtareas: muévelas o bórralas primero'))
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await abrirMenu(user, 'Comprar pan')
    await user.click(screen.getByRole('menuitem', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Borrar tarea' })
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('tiene subtareas')
    expect(dialogo).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Borrar' })).toBeEnabled()
  })
})

describe('Acciones: recordatorio pendiente', () => {
  it.each([
    ['hecha', async (user: Usuario) => user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))],
    [
      'cancelar',
      async (user: Usuario) => {
        await abrirMenu(user, 'Comprar pan')
        await user.click(screen.getByRole('menuitem', { name: 'Cancelar' }))
      },
    ],
  ])('al %s pregunta si hay uno sin enviar y "Borrar recordatorio" lo borra', async (_, accion) => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ id: 50, tareaId: 7 })])
    const { invalidar } = renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await accion(user)
    const pregunta = await screen.findByRole('dialog', { name: 'Recordatorio pendiente' })
    expect(getRecordatoriosDeTarea).toHaveBeenCalledWith(7)
    await user.click(within(pregunta).getByRole('button', { name: 'Borrar recordatorio' }))
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(50))
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['recordatorios'] })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('"Conservarlo" no borra nada', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue([recordatorio({ id: 50, tareaId: 7 })])
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Recordatorio pendiente' })).getByRole('button', { name: 'Conservarlo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(borrarRecordatorio).not.toHaveBeenCalled()
  })

  it.each([
    ['sin recordatorio', [] as Recordatorio[]],
    ['con el recordatorio ya enviado', [recordatorio({ enviado: true })]],
  ])('%s no pregunta nada', async (_, lista) => {
    const user = userEvent.setup()
    vi.mocked(getRecordatoriosDeTarea).mockResolvedValue(lista)
    renderizar([tarea({ id: 7, titulo: 'Comprar pan' })])
    await user.click(await screen.findByRole('button', { name: 'Marcar «Comprar pan» como hecha' }))
    await waitFor(() => expect(getRecordatoriosDeTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Marcada como hecha')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Acciones: desde el diálogo de edición', () => {
  const informe = tarea({ id: 7, titulo: 'Informe', horaInicio: '09:30:00', horaFin: '10:30:00' })

  async function abrirEdicion(user: Usuario) {
    await user.click(await screen.findByRole('button', { name: /Informe/ }))
    return screen.findByRole('dialog', { name: 'Editar tarea' })
  }

  it('Marcar hecha manda el PATCH, cierra el diálogo y no queda nada por guardar', async () => {
    const user = userEvent.setup()
    renderizar([], [informe])
    const dialogo = await abrirEdicion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Marcar hecha' }))
    await waitFor(() => expect(marcarHecha).toHaveBeenCalledWith(7))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(actualizarTarea).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Marcada como hecha')
  })

  it('Posponer manda el PATCH y confirma con la fecha', async () => {
    const user = userEvent.setup()
    renderizar([], [informe])
    await user.click(within(await abrirEdicion(user)).getByRole('button', { name: 'Posponer' }))
    await waitFor(() => expect(posponerTarea).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('status')).toHaveTextContent('Pospuesta al 11 de noviembre')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar tarea' })).not.toBeInTheDocument())
  })

  it('Borrar pide confirmación y, al confirmar, borra y cierra la edición', async () => {
    const user = userEvent.setup()
    renderizar([], [informe])
    await user.click(within(await abrirEdicion(user)).getByRole('button', { name: 'Borrar' }))
    const confirmar = await screen.findByRole('dialog', { name: 'Borrar tarea' })
    expect(borrarTarea).not.toHaveBeenCalled()
    await user.click(within(confirmar).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrarTarea).toHaveBeenCalledWith(7))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('una tarea hecha ofrece Reabrir y no ofrece Posponer', async () => {
    const user = userEvent.setup()
    renderizar([], [{ ...informe, estado: 'HECHO' }])
    const dialogo = await abrirEdicion(user)
    expect(within(dialogo).getByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Posponer' })).not.toBeInTheDocument()
  })

  it('una tarea cancelada ofrece Reactivar: PUT con estado PENDIENTE', async () => {
    const user = userEvent.setup()
    renderizar([], [{ ...informe, estado: 'CANCELADO' }])
    const dialogo = await abrirEdicion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Reactivar' }))
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(7, expect.objectContaining({ estado: 'PENDIENTE' })))
    expect(await screen.findByRole('status')).toHaveTextContent('Reactivada')
  })

  it('un error de la acción se muestra dentro del diálogo, que sigue abierto', async () => {
    const user = userEvent.setup()
    vi.mocked(marcarHecha).mockRejectedValue(new ApiError(404, 'Tarea no encontrada: 7'))
    renderizar([], [informe])
    const dialogo = await abrirEdicion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Marcar hecha' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Tarea no encontrada: 7')
  })
})
