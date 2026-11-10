import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'
import { ProyectosPage } from './ProyectosPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { actualizarProyecto, borrarProyecto, crearProyecto, getImpactoBorradoProyecto, getProyectos } from '@/api/proyectos'
import { SIN_DEPENDENCIAS_PROYECTO } from '@/test/impactoBorrado'

// Un "servidor" en memoria: las mutaciones lo cambian y la lista que se vuelve a pedir lo refleja.
let datos: Proyecto[]
let objetivos: Objetivo[]

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProyectosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  datos = [
    proyecto({ id: 1, nombre: 'Casa', estado: 'EN_PAUSA', prioridad: 'ALTA', objetivoId: 5, descripcion: 'Todo el piso' }),
    proyecto({ id: 2, nombre: 'Mudanza', padreId: 1 }),
    proyecto({ id: 3, nombre: 'Cajas', padreId: 2 }),
    proyecto({ id: 4, nombre: 'Otro' }),
  ]
  objetivos = [objetivo({ id: 5, nombre: 'Mudarme' }), objetivo({ id: 6, nombre: 'Salud' })]
  vi.mocked(getProyectos).mockImplementation(async () => datos.map((d) => ({ ...d })))
  vi.mocked(getObjetivos).mockImplementation(async () => objetivos.map((o) => ({ ...o })))
  vi.mocked(crearProyecto).mockImplementation(async (r) => {
    const nuevo = proyecto({ ...r, id: 100 })
    datos.push(nuevo)
    return nuevo
  })
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

const nombres = () => screen.getAllByRole('link').map((a) => a.textContent)
const aviso = () => screen.getByRole('status')

async function abrirMenu(user: ReturnType<typeof userEvent.setup>, nombre: string, opcion: 'Editar' | 'Borrar') {
  await user.click(await screen.findByRole('button', { name: `Acciones de «${nombre}»` }))
  await user.click(await screen.findByRole('menuitem', { name: opcion }))
  return screen.findByRole('dialog')
}

describe('ProyectosPage: crear', () => {
  it('crea un proyecto: manda el cuerpo completo, avisa y refresca la lista', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.click(screen.getByRole('button', { name: 'Nuevo proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('heading', { name: 'Nuevo proyecto' })).toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Nombre'), '  Aprender a nadar  ')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearProyecto).toHaveBeenCalledTimes(1))
    expect(crearProyecto).toHaveBeenCalledWith({ nombre: 'Aprender a nadar', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null, objetivoId: null })
    await waitFor(() => expect(aviso()).toHaveTextContent('Proyecto «Aprender a nadar» creado'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Aprender a nadar' })).toBeInTheDocument()
  })

  it('crea con estado, prioridad, objetivo y padre elegidos', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.click(screen.getByRole('button', { name: 'Nuevo proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Pintar')
    await user.selectOptions(within(dialogo).getByLabelText('Estado'), 'EN_PROGRESO')
    await user.selectOptions(within(dialogo).getByLabelText('Prioridad'), 'MEDIA')
    await user.selectOptions(within(dialogo).getByLabelText('Objetivo'), '6')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    await user.click(within(dialogo).getByRole('button', { name: /Otro/ }))
    expect(within(dialogo).getByTestId('padre-actual')).toHaveTextContent('«Otro»')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearProyecto).toHaveBeenCalledTimes(1))
    expect(crearProyecto).toHaveBeenCalledWith({ nombre: 'Pintar', descripcion: null, estado: 'EN_PROGRESO', prioridad: 'MEDIA', padreId: 4, objetivoId: 6 })
  })

  it('valida el nombre: obligatorio y máximo 150; no llama a la API', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.click(screen.getByRole('button', { name: 'Nuevo proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByText('El nombre es obligatorio')).toBeInTheDocument()

    await user.click(within(dialogo).getByLabelText('Nombre'))
    await user.paste('x'.repeat(151))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByText('El nombre admite como máximo 150 caracteres')).toBeInTheDocument()
    expect(crearProyecto).not.toHaveBeenCalled()
  })

  it('un error del servidor se ve en el diálogo, que sigue abierto', async () => {
    vi.mocked(crearProyecto).mockRejectedValue(new ApiError(400, 'El objetivo no existe: 9'))
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.click(screen.getByRole('button', { name: 'Nuevo proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'X')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El objetivo no existe: 9')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ProyectosPage: editar', () => {
  it('abre con los valores actuales y manda los seis campos al guardar', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    const dialogo = await abrirMenu(user, 'Casa', 'Editar')
    expect(within(dialogo).getByRole('heading', { name: 'Editar proyecto' })).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Casa')
    expect(within(dialogo).getByLabelText('Descripción')).toHaveValue('Todo el piso')
    expect(within(dialogo).getByLabelText('Estado')).toHaveValue('EN_PAUSA')
    expect(within(dialogo).getByLabelText('Prioridad')).toHaveValue('ALTA')
    expect(within(dialogo).getByLabelText('Objetivo')).toHaveValue('5')
    expect(within(dialogo).getByTestId('padre-actual')).toHaveTextContent('Sin padre')

    await user.clear(within(dialogo).getByLabelText('Nombre'))
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Casa nueva')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledTimes(1))
    // Estado, prioridad, padre y objetivo no se tocaron y se reenvían: el PUT reemplaza todo.
    expect(actualizarProyecto).toHaveBeenCalledWith(1, {
      nombre: 'Casa nueva',
      descripcion: 'Todo el piso',
      estado: 'EN_PAUSA',
      prioridad: 'ALTA',
      padreId: null,
      objetivoId: 5,
    })
    await waitFor(() => expect(aviso()).toHaveTextContent('«Casa nueva» guardado'))
    expect(await screen.findByRole('link', { name: 'Casa nueva' })).toBeInTheDocument()
  })

  it('sin tocar el campo Padre, el PUT conserva el original; con «Sin padre», lo quita', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')

    let dialogo = await abrirMenu(user, 'Mudanza', 'Editar')
    expect(within(dialogo).getByTestId('padre-actual')).toHaveTextContent('«Casa»')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledTimes(1))
    expect(vi.mocked(actualizarProyecto).mock.calls[0]![1].padreId).toBe(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialogo = await abrirMenu(user, 'Mudanza', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Sin padre' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledTimes(2))
    expect(vi.mocked(actualizarProyecto).mock.calls[1]![1].padreId).toBeNull()
  })

  it('el selector de padre no ofrece el propio proyecto ni sus descendientes', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    const dialogo = await abrirMenu(user, 'Casa', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    const panel = within(dialogo).getByRole('searchbox', { name: 'Buscar padre' }).closest('div')!
    const opciones = within(panel).getAllByRole('button').map((b) => b.textContent)
    expect(opciones).toEqual(['Sin padre (actual)', 'OtroProyecto principal'])
  })

  it('Escape con la lista de padres abierta cierra solo la lista, no el diálogo', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    const dialogo = await abrirMenu(user, 'Casa', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar' }))
    await user.keyboard('{Escape}')
    expect(within(dialogo).queryByRole('searchbox', { name: 'Buscar padre' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('si los objetivos no cargan, el objetivo actual se conserva al guardar', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    const dialogo = await abrirMenu(user, 'Casa', 'Editar')
    expect(within(dialogo).getByLabelText('Objetivo')).toHaveValue('5')
    expect(within(dialogo).getByText('No se pudo cargar la lista de objetivos; se conserva el actual.')).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledTimes(1))
    expect(vi.mocked(actualizarProyecto).mock.calls[0]![1].objetivoId).toBe(5)
  })
})

describe('ProyectosPage: cambio rápido de estado', () => {
  it('manda el PUT completo, avisa y NO toca a los hijos', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Casa»' }), 'EN_PROGRESO')

    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledTimes(1))
    expect(actualizarProyecto).toHaveBeenCalledWith(1, {
      nombre: 'Casa',
      descripcion: 'Todo el piso',
      estado: 'EN_PROGRESO',
      prioridad: 'ALTA',
      padreId: null,
      objetivoId: 5,
    })
    await waitFor(() => expect(aviso()).toHaveTextContent('«Casa» pasó a En progreso'))
    expect(aviso()).not.toHaveTextContent('filtro')
    // Sin propagación: los hijos conservan su estado y no recibieron ningún PUT.
    expect(vi.mocked(actualizarProyecto).mock.calls.map((c) => c[0])).toEqual([1])
    expect(screen.getByRole('combobox', { name: 'Cambiar estado de «Mudanza»' })).toHaveValue('PENDIENTE')
  })

  it('si el nuevo estado queda fuera del filtro, el aviso lo dice y la fila desaparece', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Otro')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Otro»' }), 'HECHO')
    await waitFor(() => expect(aviso()).toHaveTextContent('«Otro» pasó a Hecho; ya no se ve con el filtro actual'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Otro' })).not.toBeInTheDocument())
  })

  it('con «Todos» el mismo cambio no avisa de filtro', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Otro')
    await user.selectOptions(screen.getByLabelText('Estado'), 'todos')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Otro»' }), 'HECHO')
    await waitFor(() => expect(aviso()).toHaveTextContent('«Otro» pasó a Hecho'))
    expect(aviso()).not.toHaveTextContent('filtro')
  })

  it('si el servidor rechaza el cambio, muestra el error', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValue(new ApiError(400, 'Datos inválidos'))
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambiar estado de «Casa»' }), 'HECHO')
    expect(await screen.findByRole('alert')).toHaveTextContent('Datos inválidos')
  })
})

describe('ProyectosPage: borrar', () => {
  it('pide confirmación, borra, avisa y saca la fila', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Otro')
    const dialogo = await abrirMenu(user, 'Otro', 'Borrar')
    expect(within(dialogo).getByRole('heading', { name: 'Borrar proyecto' })).toBeInTheDocument()
    expect(within(dialogo).getByText('¿Borrar «Otro»? No se puede deshacer.')).toBeInTheDocument()
    expect(borrarProyecto).not.toHaveBeenCalled()

    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalledWith(4))
    await waitFor(() => expect(aviso()).toHaveTextContent('«Otro» borrado'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Otro' })).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un 409 muestra el mensaje del servidor tal cual y el diálogo sigue abierto', async () => {
    vi.mocked(borrarProyecto).mockRejectedValue(new ApiError(409, 'El proyecto 1 tiene subproyectos: muévelos o bórralos primero'))
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Casa')
    const dialogo = await abrirMenu(user, 'Casa', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El proyecto 1 tiene subproyectos: muévelos o bórralos primero')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Con el diálogo abierto, Radix deja la página con aria-hidden: hay que pedirlo con `hidden`.
    expect(screen.getByRole('link', { name: 'Casa', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('')

    // Se puede cancelar y no vuelve a llamar.
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(borrarProyecto).toHaveBeenCalledTimes(1)
  })

  it('cancelar no llama a la API', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Otro')
    const dialogo = await abrirMenu(user, 'Otro', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(borrarProyecto).not.toHaveBeenCalled()
    expect(nombres()).toContain('Otro')
  })
})
