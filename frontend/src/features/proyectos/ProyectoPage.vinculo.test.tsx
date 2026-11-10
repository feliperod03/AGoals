import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea } from '@/types/tarea'
import { ProyectoPage } from './ProyectoPage'

vi.mock('@/api/proyectos', () => ({
  getProyectos: vi.fn(),
  crearProyecto: vi.fn(),
  actualizarProyecto: vi.fn(),
  borrarProyecto: vi.fn(),
  getImpactoBorradoProyecto: vi.fn(),
  asignarTarea: vi.fn(),
  quitarTarea: vi.fn(),
}))
vi.mock('@/api/objetivos', () => ({
  getObjetivos: vi.fn(),
  crearObjetivo: vi.fn(),
  actualizarObjetivo: vi.fn(),
  borrarObjetivo: vi.fn(),
  getImpactoBorradoObjetivo: vi.fn(),
  asignarTarea: vi.fn(),
  quitarTarea: vi.fn(),
}))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
import { asignarTarea as asignarObjetivo, getObjetivos, quitarTarea as quitarObjetivo } from '@/api/objetivos'
import { asignarTarea, getProyectos, quitarTarea } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

let proyectos: Proyecto[]
let tareas: Tarea[]

function renderizar(ruta = '/proyectos/1') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/proyectos/:id" element={<ProyectoPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const seccion = () => screen.getByRole('heading', { name: 'Tareas ligadas', level: 2 }).closest('section') as HTMLElement
const ligadas = async () => {
  await screen.findByRole('heading', { name: 'Casa', level: 1 })
  await waitFor(() => expect(within(seccion()).getByText('Pedir presupuesto')).toBeInTheDocument())
  return within(seccion())
}

beforeEach(() => {
  vi.resetAllMocks()
  proyectos = [
    proyecto({ id: 1, nombre: 'Casa', estado: 'EN_PROGRESO' }),
    proyecto({ id: 4, nombre: 'Otro' }),
    proyecto({ id: 5, nombre: 'Terminado', estado: 'HECHO' }),
  ]
  tareas = [
    tarea({ id: 10, titulo: 'Pedir presupuesto', proyectoId: 1 }),
    tarea({ id: 11, titulo: 'Llamar al flete', proyectoId: 1, padreId: 10 }),
    tarea({ id: 12, titulo: 'Hija de otro proyecto', proyectoId: 4, padreId: 10 }),
    tarea({ id: 13, titulo: 'De otro proyecto', proyectoId: 4 }),
    tarea({ id: 14, titulo: 'Suelta', fecha: '2026-11-12' }),
    tarea({ id: 15, titulo: 'Hecha y suelta', estado: 'HECHO' }),
    tarea({ id: 16, titulo: 'Del objetivo', objetivoId: 3 }),
  ]
  vi.mocked(getProyectos).mockImplementation(async () => proyectos.map((p) => ({ ...p })))
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 3, nombre: 'Vivir solo' })])
  vi.mocked(getTareas).mockImplementation(async () => tareas.map((t) => ({ ...t })))
  vi.mocked(asignarTarea).mockImplementation(async (id, tareaId) => {
    tareas = tareas.map((t) => (t.id === tareaId ? { ...t, proyectoId: id } : t))
    return tareas.find((t) => t.id === tareaId)!
  })
  vi.mocked(quitarTarea).mockImplementation(async (_id, tareaId) => {
    tareas = tareas.map((t) => (t.id === tareaId ? { ...t, proyectoId: null } : t))
  })
})

describe('ProyectoPage: tareas ligadas (8.4b)', () => {
  it('«Quitar» aparece solo en las ligadas directamente, no en las subtareas anidadas de otro proyecto', async () => {
    renderizar()
    const s = await ligadas()
    expect(s.getByRole('button', { name: 'Quitar «Pedir presupuesto» del proyecto' })).toBeInTheDocument()
    expect(s.getByRole('button', { name: 'Quitar «Llamar al flete» del proyecto' })).toBeInTheDocument()
    expect(s.queryByRole('button', { name: /Hija de otro proyecto/ })).not.toBeInTheDocument()
  })

  it('quitar: DELETE, aviso en la región status de la página y la fila desaparece', async () => {
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    const antes = vi.mocked(getTareas).mock.calls.length
    await user.click(s.getByRole('button', { name: 'Quitar «Pedir presupuesto» del proyecto' }))
    await waitFor(() => expect(quitarTarea).toHaveBeenCalledWith(1, 10))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Pedir presupuesto» ya no es del proyecto «Casa»'))
    await waitFor(() => expect(within(seccion()).queryByText('Pedir presupuesto')).not.toBeInTheDocument())
    expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThan(antes)
    expect(quitarObjetivo).not.toHaveBeenCalled()
  })

  it('400 al quitar: el mensaje se ve en la sección y se refrescan las tareas', async () => {
    vi.mocked(quitarTarea).mockRejectedValue(new ApiError(400, 'La tarea 10 no pertenece al proyecto 1'))
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    const antes = vi.mocked(getTareas).mock.calls.length
    await user.click(s.getByRole('button', { name: 'Quitar «Pedir presupuesto» del proyecto' }))
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent('La tarea 10 no pertenece al proyecto 1')
    await waitFor(() => expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThan(antes))
  })

  it('«Vincular una existente» ofrece solo tareas abiertas que no son del proyecto y avisa que se moverá', async () => {
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    await user.click(s.getByRole('button', { name: 'Vincular una existente' }))
    const filas = within(seccion()).getAllByRole('button').filter((b) => b.closest('ul')?.className.includes('max-h-48'))
    expect(filas.map((f) => f.textContent)).toEqual([
      'De otro proyectoAhora es del proyecto «Otro»; se moverá',
      'Del objetivoSin proyecto · sin fecha',
      'Hija de otro proyectoAhora es del proyecto «Otro»; se moverá',
      'SueltaSin proyecto · 12 de noviembre',
    ])
  })

  it('vincular una suelta: PUT al proyecto, aviso, la tarea aparece en la lista y el buscador se cierra', async () => {
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    await user.click(s.getByRole('button', { name: 'Vincular una existente' }))
    await user.click(within(seccion()).getByRole('button', { name: /^Suelta/ }))
    await waitFor(() => expect(asignarTarea).toHaveBeenCalledWith(1, 14))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Suelta» ahora es del proyecto «Casa»'))
    await waitFor(() => expect(within(seccion()).getByRole('button', { name: 'Quitar «Suelta» del proyecto' })).toBeInTheDocument())
    expect(within(seccion()).queryByLabelText('Buscar tarea')).not.toBeInTheDocument()
    expect(asignarObjetivo).not.toHaveBeenCalled()
  })

  it('reasignar una de otro proyecto la mueve a este', async () => {
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    await user.click(s.getByRole('button', { name: 'Vincular una existente' }))
    await user.click(within(seccion()).getByRole('button', { name: /^De otro proyecto/ }))
    await waitFor(() => expect(asignarTarea).toHaveBeenCalledWith(1, 13))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«De otro proyecto» ahora es del proyecto «Casa»'))
  })

  it('404 al vincular: el buscador sigue abierto con el error y se refresca la lista de proyectos', async () => {
    vi.mocked(asignarTarea).mockRejectedValue(new ApiError(404, 'No existe la tarea 14'))
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    const proyectosAntes = vi.mocked(getProyectos).mock.calls.length
    await user.click(s.getByRole('button', { name: 'Vincular una existente' }))
    await user.click(within(seccion()).getByRole('button', { name: /^Suelta/ }))
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent('No existe la tarea 14')
    expect(within(seccion()).getByLabelText('Buscar tarea')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(getProyectos).mock.calls.length).toBeGreaterThan(proyectosAntes))
  })

  it('con el proyecto cerrado no se ofrece vincular, pero sí quitar', async () => {
    proyectos = [proyecto({ id: 1, nombre: 'Casa', estado: 'HECHO' })]
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    expect(s.queryByRole('button', { name: 'Vincular una existente' })).not.toBeInTheDocument()
    await user.click(s.getByRole('button', { name: 'Quitar «Pedir presupuesto» del proyecto' }))
    await waitFor(() => expect(quitarTarea).toHaveBeenCalledWith(1, 10))
  })

  it('mientras hay una mutación en curso, los botones se deshabilitan y un doble clic envía una sola llamada', async () => {
    let terminar: () => void = () => {}
    vi.mocked(quitarTarea).mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminar = () => {
            tareas = tareas.map((t) => (t.id === 10 ? { ...t, proyectoId: null } : t))
            resolver()
          }
        }),
    )
    const user = userEvent.setup()
    renderizar()
    const s = await ligadas()
    const quitar = s.getByRole('button', { name: 'Quitar «Pedir presupuesto» del proyecto' })
    await Promise.all([user.click(quitar), user.click(quitar)])
    await waitFor(() => expect(s.getByRole('button', { name: 'Vincular una existente' })).toBeDisabled())
    expect(s.getByRole('button', { name: 'Quitar «Llamar al flete» del proyecto' })).toBeDisabled()
    expect(quitarTarea).toHaveBeenCalledTimes(1)
    terminar()
    await waitFor(() => expect(s.getByRole('button', { name: 'Vincular una existente' })).toBeEnabled())
    expect(quitarTarea).toHaveBeenCalledTimes(1)
  })
})
