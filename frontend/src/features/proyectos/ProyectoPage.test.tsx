import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'
import { ProyectoPage } from './ProyectoPage'
import { ProyectosPage } from './ProyectosPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { actualizarProyecto, borrarProyecto, getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

let datos: Proyecto[]
let objetivos: Objetivo[]

function renderizar(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/proyectos" element={<ProyectosPage />} />
          <Route path="/proyectos/:id" element={<ProyectoPage />} />
          <Route path="/objetivos/:id" element={<p>Detalle del objetivo</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  datos = [
    proyecto({ id: 1, nombre: 'Casa', estado: 'EN_PROGRESO', prioridad: 'ALTA', descripcion: 'Todo el piso', objetivoId: 5 }),
    proyecto({ id: 2, nombre: 'Mudanza', padreId: 1, prioridad: 'MEDIA' }),
    proyecto({ id: 3, nombre: 'Cajas viejas', padreId: 1, estado: 'HECHO' }),
    proyecto({ id: 4, nombre: 'Otro' }),
  ]
  objetivos = [objetivo({ id: 5, nombre: 'Mudarme' })]
  vi.mocked(getProyectos).mockImplementation(async () => datos.map((d) => ({ ...d })))
  vi.mocked(getObjetivos).mockImplementation(async () => objetivos.map((o) => ({ ...o })))
  vi.mocked(getTareas).mockResolvedValue([
    tarea({ id: 10, titulo: 'Pedir presupuesto', proyectoId: 1, prioridad: 'ALTA', fecha: '2026-11-12' }),
    tarea({ id: 11, titulo: 'Llamar al flete', proyectoId: 1, padreId: 10 }),
    tarea({ id: 12, titulo: 'Tarea hecha', proyectoId: 1, estado: 'HECHO' }),
    tarea({ id: 13, titulo: 'De otro proyecto', proyectoId: 4 }),
    tarea({ id: 14, titulo: 'De un objetivo', objetivoId: 5 }),
    tarea({ id: 15, titulo: 'Suelta' }),
  ])
  vi.mocked(actualizarProyecto).mockImplementation(async (id, r) => {
    datos = datos.map((d) => (d.id === id ? { ...d, ...r } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(borrarProyecto).mockImplementation(async (id) => {
    datos = datos.filter((d) => d.id !== id)
  })
})
afterEach(() => vi.resetAllMocks())

const seccion = (titulo: string) => screen.getByRole('heading', { name: titulo, level: 2 }).closest('section')!

describe('ProyectoPage: datos', () => {
  it('muestra nombre, estado, prioridad, descripción, padre, objetivo y subproyectos', async () => {
    renderizar('/proyectos/2')
    expect(await screen.findByRole('heading', { name: 'Mudanza', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de «Mudanza»' })).toHaveValue('PENDIENTE')
    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('Sin descripción.')).toBeInTheDocument()
    expect(within(seccion('Datos')).getByRole('link', { name: 'Casa' })).toHaveAttribute('href', '/proyectos/1')
    expect(within(seccion('Datos')).getByText('Sin objetivo')).toBeInTheDocument()
    expect(within(seccion('Subproyectos')).getByText('Este proyecto no tiene subproyectos.')).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('un proyecto con hijos y objetivo: los enlaza, ordenados y con su estado', async () => {
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    expect(screen.getByText('Todo el piso')).toBeInTheDocument()
    expect(within(seccion('Datos')).getByText('Sin padre')).toBeInTheDocument()
    expect(within(seccion('Datos')).getByRole('link', { name: 'Mudarme' })).toHaveAttribute('href', '/objetivos/5')
    const hijos = within(seccion('Subproyectos')).getAllByRole('link')
    expect(hijos.map((a) => a.textContent)).toEqual(['Mudanza', 'Cajas viejas']) // los cerrados también se listan, al final por nombre
    expect(hijos[0]).toHaveAttribute('href', '/proyectos/2')
    expect(within(seccion('Subproyectos')).getByText('Hecho')).toBeInTheDocument()
  })

  it('el objetivo se muestra con su número si la lista de objetivos no cargó', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar('/proyectos/1')
    expect(await within(await screen.findByRole('heading', { name: 'Datos', level: 2 }).then(() => seccion('Datos'))).findByRole('link', { name: 'n.º 5' })).toBeInTheDocument()
  })

  it('las tareas ligadas son solo las de este proyecto, anidadas y SIN acciones', async () => {
    renderizar('/proyectos/1')
    const tareas = await screen.findByText('Pedir presupuesto').then(() => seccion('Tareas ligadas'))
    expect(within(tareas).getByText('Pedir presupuesto')).toBeInTheDocument()
    expect(within(tareas).getByText('Llamar al flete')).toBeInTheDocument()
    expect(within(tareas).getByText('Tarea hecha')).toBeInTheDocument()
    expect(within(tareas).queryByText('De otro proyecto')).not.toBeInTheDocument()
    expect(within(tareas).queryByText('De un objetivo')).not.toBeInTheDocument()
    expect(within(tareas).queryByText('Suelta')).not.toBeInTheDocument()
    // Solo lectura: ni botones ni enlaces ni menús.
    expect(within(tareas).queryByRole('button')).not.toBeInTheDocument()
    expect(within(tareas).queryByRole('link')).not.toBeInTheDocument()
    // La subtarea ligada cuelga de su madre.
    const madre = within(tareas).getByText('Pedir presupuesto').closest('li')!
    expect(within(madre).getByText('Llamar al flete')).toBeInTheDocument()
    expect(within(tareas).getByText('12 de noviembre')).toBeInTheDocument()
  })

  it('sin tareas ligadas lo dice', async () => {
    renderizar('/proyectos/2')
    await screen.findByRole('heading', { name: 'Mudanza', level: 1 })
    expect(await within(seccion('Tareas ligadas')).findByText('Este proyecto no tiene tareas ligadas.')).toBeInTheDocument()
  })

  it('si las tareas fallan, el resto del detalle se muestra igual', async () => {
    vi.mocked(getTareas).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    expect(await within(seccion('Tareas ligadas')).findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.getByText('Todo el piso')).toBeInTheDocument()
  })
})

describe('ProyectoPage: no encontrado, cargando y error', () => {
  it('un id que no existe muestra «Proyecto no encontrado» con enlace de vuelta', async () => {
    renderizar('/proyectos/999')
    expect(await screen.findByRole('heading', { name: 'Proyecto no encontrado', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Proyectos' })).toHaveAttribute('href', '/proyectos')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('un id que no es un número también', async () => {
    renderizar('/proyectos/abc')
    expect(await screen.findByRole('heading', { name: 'Proyecto no encontrado', level: 1 })).toBeInTheDocument()
  })

  it('muestra cargando y luego el detalle', async () => {
    renderizar('/proyectos/1')
    expect(screen.getByText('Cargando tus proyectos…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Casa', level: 1 })).toBeInTheDocument()
  })

  it('si la lista falla, muestra el error del servidor y no «no encontrado»', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar('/proyectos/1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
    expect(screen.queryByText('Proyecto no encontrado')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Proyectos' })).toBeInTheDocument()
  })
})

describe('ProyectoPage: editar, estado y borrar desde el detalle', () => {
  it('Editar guarda con todos los campos y el detalle muestra el cambio', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    await user.clear(within(dialogo).getByLabelText('Nombre'))
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Casa nueva')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledWith(1, {
      nombre: 'Casa nueva',
      descripcion: 'Todo el piso',
      estado: 'EN_PROGRESO',
      prioridad: 'ALTA',
      padreId: null,
      objetivoId: 5,
    }))
    expect(await screen.findByRole('heading', { name: 'Casa nueva', level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Casa nueva» guardado'))
  })

  it('cambiar el estado avisa sin hablar de filtros (el detalle no tiene) y no toca a los hijos', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Casa»' }), 'HECHO')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Casa» pasó a Hecho'))
    expect(screen.getByRole('status')).not.toHaveTextContent('filtro')
    expect(vi.mocked(actualizarProyecto).mock.calls.map((c) => c[0])).toEqual([1])
    // Sigue en pantalla aunque esté hecho.
    expect(screen.getByRole('heading', { name: 'Casa', level: 1 })).toBeInTheDocument()
  })

  it('Borrar vuelve a la lista y muestra allí el aviso', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/4')
    await screen.findByRole('heading', { name: 'Otro', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(borrarProyecto).not.toHaveBeenCalled()
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))

    expect(await screen.findByRole('heading', { name: 'Proyectos', level: 1 })).toBeInTheDocument()
    expect(borrarProyecto).toHaveBeenCalledWith(4)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Otro» borrado'))
    expect(screen.queryByText('Proyecto no encontrado')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Otro' })).not.toBeInTheDocument())
  })

  it('Borrar con un 409 muestra el mensaje del servidor y se queda en el detalle', async () => {
    vi.mocked(borrarProyecto).mockRejectedValue(new ApiError(409, 'El proyecto 1 tiene tareas: desasígnalas primero'))
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El proyecto 1 tiene tareas: desasígnalas primero')
    expect(screen.getByRole('heading', { name: 'Casa', level: 1, hidden: true })).toBeInTheDocument()
  })
})
