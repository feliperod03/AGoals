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

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
// La sección «Ideas ligadas» pide la lista de ideas; aquí no importa su contenido (se prueba en *.ideas.test.tsx).
vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn(async () => []) }))
import { getObjetivos } from '@/api/objetivos'
import { actualizarProyecto, borrarProyecto, getImpactoBorradoProyecto, getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'
import { SIN_DEPENDENCIAS_PROYECTO } from '@/test/impactoBorrado'

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
  objetivos = [objetivo({ id: 5, nombre: 'Mudarme' }), objetivo({ id: 6, nombre: 'Viajar' }), objetivo({ id: 7, nombre: 'Viejo', estado: 'HECHO' })]
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
  vi.mocked(getImpactoBorradoProyecto).mockResolvedValue(SIN_DEPENDENCIAS_PROYECTO)
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
    expect(within(seccion('Datos')).getByRole('combobox', { name: 'Objetivo de «Mudanza»' })).toHaveValue('')
    expect(within(seccion('Datos')).queryByRole('link', { name: 'Ver objetivo' })).not.toBeInTheDocument()
    expect(within(seccion('Subproyectos')).getByText('Este proyecto no tiene subproyectos.')).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('un proyecto con hijos y objetivo: los enlaza, ordenados y con su estado', async () => {
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    expect(screen.getByText('Todo el piso')).toBeInTheDocument()
    expect(within(seccion('Datos')).getByText('Sin padre')).toBeInTheDocument()
    expect(within(seccion('Datos')).getByRole('combobox', { name: 'Objetivo de «Casa»' })).toHaveValue('5')
    expect(within(seccion('Datos')).getByRole('option', { name: 'Mudarme' })).toBeInTheDocument()
    expect(within(seccion('Datos')).getByRole('link', { name: 'Ver objetivo' })).toHaveAttribute('href', '/objetivos/5')
    const hijos = within(seccion('Subproyectos')).getAllByRole('link')
    expect(hijos.map((a) => a.textContent)).toEqual(['Mudanza', 'Cajas viejas']) // los cerrados también se listan, al final por nombre
    expect(hijos[0]).toHaveAttribute('href', '/proyectos/2')
    expect(within(seccion('Subproyectos')).getByText('Hecho')).toBeInTheDocument()
  })

  it('el objetivo se muestra con su número si la lista de objetivos no cargó, y la nota lo explica', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    renderizar('/proyectos/1')
    const datos = await screen.findByRole('heading', { name: 'Datos', level: 2 }).then(() => seccion('Datos'))
    expect(await within(datos).findByText('No se pudo cargar la lista de objetivos.')).toBeInTheDocument()
    const selector = within(datos).getByRole('combobox', { name: 'Objetivo de «Casa»' })
    expect(selector).toHaveValue('5')
    expect(within(selector).getByRole('option', { name: 'Objetivo n.º 5' })).toBeInTheDocument()
    expect(selector).toBeEnabled() // con la lista fallida se puede al menos quitar el vínculo
  })

  it('las tareas ligadas son solo las de este proyecto y anidadas; sin menús ni enlaces', async () => {
    renderizar('/proyectos/1')
    const tareas = await screen.findByText('Pedir presupuesto').then(() => seccion('Tareas ligadas'))
    expect(within(tareas).getByText('Pedir presupuesto')).toBeInTheDocument()
    expect(within(tareas).getByText('Llamar al flete')).toBeInTheDocument()
    expect(within(tareas).getByText('Tarea hecha')).toBeInTheDocument()
    expect(within(tareas).queryByText('De otro proyecto')).not.toBeInTheDocument()
    expect(within(tareas).queryByText('De un objetivo')).not.toBeInTheDocument()
    expect(within(tareas).queryByText('Suelta')).not.toBeInTheDocument()
    // Solo «Quitar» por tarea ligada directamente y «Vincular una existente»: ni menús ni enlaces.
    expect(within(tareas).getAllByRole('button').map((b) => b.textContent)).toEqual(['Vincular una existente', 'Quitar', 'Quitar', 'Quitar'])
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

describe('ProyectoPage: cambiar el objetivo desde «Datos»', () => {
  const selectorDe = async (nombre: string) => {
    await screen.findByRole('heading', { name: nombre, level: 1 })
    return within(seccion('Datos')).getByRole('combobox', { name: `Objetivo de «${nombre}»` })
  }

  it('elegir otro objetivo manda el PUT con los seis campos, avisa y el campo lo refleja', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/4')
    await user.selectOptions(await selectorDe('Otro'), '6')

    await waitFor(() =>
      expect(actualizarProyecto).toHaveBeenCalledWith(4, {
        nombre: 'Otro',
        descripcion: null,
        estado: 'PENDIENTE',
        prioridad: null,
        padreId: null,
        objetivoId: 6,
      }),
    )
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Otro» ahora es parte de «Viajar»'))
    await waitFor(() => expect(within(seccion('Datos')).getByRole('combobox', { name: 'Objetivo de «Otro»' })).toHaveValue('6'))
    expect(within(seccion('Datos')).getByRole('link', { name: 'Ver objetivo' })).toHaveAttribute('href', '/objetivos/6')
  })

  it('«Sin objetivo» lo quita y reenvía todo lo demás tal cual', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    await user.selectOptions(await selectorDe('Casa'), '')

    await waitFor(() =>
      expect(actualizarProyecto).toHaveBeenCalledWith(1, {
        nombre: 'Casa',
        descripcion: 'Todo el piso',
        estado: 'EN_PROGRESO',
        prioridad: 'ALTA',
        padreId: null,
        objetivoId: null,
      }),
    )
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Casa» ya no pertenece a «Mudarme»'))
    await waitFor(() => expect(within(seccion('Datos')).queryByRole('link', { name: 'Ver objetivo' })).not.toBeInTheDocument())
  })

  it('ofrece los objetivos abiertos más el actual aunque esté cerrado, igual que el diálogo de edición', async () => {
    datos = [...datos, proyecto({ id: 6, nombre: 'Con objetivo cerrado', objetivoId: 7 })]
    renderizar('/proyectos/6')
    const cerrado = await selectorDe('Con objetivo cerrado')
    await waitFor(() => expect(within(cerrado).getAllByRole('option')).toHaveLength(4))
    expect(within(cerrado).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin objetivo', 'Mudarme', 'Viajar', 'Viejo'])
    expect(cerrado).toHaveValue('7')
  })

  it('un objetivo cerrado que no es el actual no se ofrece', async () => {
    renderizar('/proyectos/4')
    const selector = await selectorDe('Otro')
    await waitFor(() => expect(within(selector).getAllByRole('option')).toHaveLength(3))
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin objetivo', 'Mudarme', 'Viajar'])
  })

  it('si el PUT falla, el error se ve bajo el campo, no avisa y el campo vuelve al valor real', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValue(new ApiError(404, 'No existe el objetivo 6'))
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    const selector = await selectorDe('Casa')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Viajar' })).toBeInTheDocument())
    await user.selectOptions(selector, '6')

    expect(await within(seccion('Datos')).findByRole('alert')).toHaveTextContent('No existe el objetivo 6')
    expect(selector).toHaveValue('5')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('el select del diálogo de edición sigue funcionando: cambiar el objetivo ahí manda el nuevo', async () => {
    const user = userEvent.setup()
    renderizar('/proyectos/1')
    await screen.findByRole('heading', { name: 'Casa', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    const select = within(dialogo).getByRole('combobox', { name: 'Objetivo' })
    expect(select).toHaveValue('5')
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Viajar' })).toBeInTheDocument())
    await user.selectOptions(select, '6')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Casa', objetivoId: 6 })))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Casa» guardado'))
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
