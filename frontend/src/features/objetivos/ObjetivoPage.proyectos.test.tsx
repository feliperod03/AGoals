import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'
import { ObjetivoPage } from './ObjetivoPage'

vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn() }))
vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { actualizarProyecto, crearProyecto, getProyectos } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

let proyectos: Proyecto[]
let objetivos: Objetivo[]

function renderizar(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/objetivos/:id" element={<ObjetivoPage />} />
          <Route path="/proyectos/:id" element={<p>Detalle del proyecto</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  objetivos = [objetivo({ id: 1, nombre: 'Salud' }), objetivo({ id: 3, nombre: 'Viajar' }), objetivo({ id: 4, nombre: 'Archivado', estado: 'HECHO' })]
  proyectos = [
    proyecto({ id: 10, nombre: 'Plan de entrenamiento', objetivoId: 1, prioridad: 'MEDIA', descripcion: 'Tres veces por semana' }),
    proyecto({ id: 11, nombre: 'Chequeo médico', objetivoId: 1, estado: 'HECHO' }),
    proyecto({ id: 12, nombre: 'Escapada a Mendoza', objetivoId: 3, estado: 'EN_PROGRESO' }),
    proyecto({ id: 13, nombre: 'Proyecto suelto' }),
    proyecto({ id: 14, nombre: 'Proyecto cerrado', estado: 'HECHO' }),
  ]
  vi.mocked(getObjetivos).mockImplementation(async () => objetivos.map((o) => ({ ...o })))
  vi.mocked(getProyectos).mockImplementation(async () => proyectos.map((p) => ({ ...p })))
  vi.mocked(getTareas).mockResolvedValue([])
  vi.mocked(actualizarProyecto).mockImplementation(async (id, r) => {
    proyectos = proyectos.map((p) => (p.id === id ? { ...p, ...r } : p))
    return proyectos.find((p) => p.id === id)!
  })
  vi.mocked(crearProyecto).mockImplementation(async (r) => {
    const nuevo = proyecto({ id: 99, fechaCreacion: '2026-11-09T10:00:00-03:00', ...r })
    proyectos = [...proyectos, nuevo]
    return nuevo
  })
})
afterEach(() => vi.resetAllMocks())

// `hidden`: con un diálogo abierto Radix deja el resto de la página con `aria-hidden`.
const seccion = () => screen.getByRole('heading', { name: 'Proyectos del objetivo', level: 2, hidden: true }).closest('section')!

/** Abre el detalle de «Salud» con sus proyectos ya cargados. */
async function abrirSalud(id = 1, nombre = 'Salud') {
  const user = userEvent.setup()
  renderizar(`/objetivos/${id}`)
  await screen.findByRole('heading', { name: nombre, level: 1 })
  await within(seccion()).findByText(/Plan de entrenamiento|no tiene proyectos/)
  return user
}

async function abrirEleccion(user: Awaited<ReturnType<typeof abrirSalud>>) {
  await user.click(within(seccion()).getByRole('button', { name: 'Agregar proyecto' }))
  return screen.findByRole('dialog')
}

describe('ObjetivoPage: quitar un proyecto del objetivo', () => {
  it('manda el PUT con los seis campos y objetivoId null, avisa y lo saca de la sección sin borrarlo', async () => {
    const user = await abrirSalud()
    await user.click(within(seccion()).getByRole('button', { name: 'Quitar «Plan de entrenamiento» del objetivo' }))

    await waitFor(() =>
      expect(actualizarProyecto).toHaveBeenCalledWith(10, {
        nombre: 'Plan de entrenamiento',
        descripcion: 'Tres veces por semana',
        estado: 'PENDIENTE',
        prioridad: 'MEDIA',
        padreId: null,
        objetivoId: null,
      }),
    )
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Plan de entrenamiento» ya no pertenece a «Salud»'))
    await waitFor(() => expect(within(seccion()).queryByRole('link', { name: 'Plan de entrenamiento' })).not.toBeInTheDocument())
    expect(within(seccion()).getByRole('link', { name: 'Chequeo médico' })).toBeInTheDocument()
  })

  it('si el servidor falla, el error se ve en la sección y el proyecto sigue', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValue(new ApiError(404, 'No existe el proyecto 10'))
    const user = await abrirSalud()
    await user.click(within(seccion()).getByRole('button', { name: 'Quitar «Plan de entrenamiento» del objetivo' }))
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent('No existe el proyecto 10')
    expect(within(seccion()).getByRole('link', { name: 'Plan de entrenamiento' })).toBeInTheDocument()
  })
})

describe('ObjetivoPage: vincular un proyecto existente', () => {
  it('vincula uno suelto: PUT con los seis campos, aviso, diálogo cerrado y proyecto en la sección', async () => {
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    expect(within(dialogo).getByRole('heading', { name: 'Agregar proyecto a «Salud»' })).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    await user.click(within(dialogo).getByRole('button', { name: /Proyecto suelto/ }))

    await waitFor(() =>
      expect(actualizarProyecto).toHaveBeenCalledWith(13, {
        nombre: 'Proyecto suelto',
        descripcion: null,
        estado: 'PENDIENTE',
        prioridad: null,
        padreId: null,
        objetivoId: 1,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('«Proyecto suelto» ahora es parte de «Salud»')
    expect(await within(seccion()).findByRole('link', { name: 'Proyecto suelto' })).toHaveAttribute('href', '/proyectos/13')
  })

  it('mueve uno de otro objetivo: la fila lo avisa y el PUT lleva el objetivo nuevo', async () => {
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    const fila = within(dialogo).getByRole('button', { name: /Escapada a Mendoza/ })
    expect(fila).toHaveTextContent('Ahora es del objetivo «Viajar»; se moverá')
    expect(within(dialogo).getByRole('button', { name: /Proyecto suelto/ })).toHaveTextContent('Sin objetivo')
    await user.click(fila)

    await waitFor(() => expect(actualizarProyecto).toHaveBeenCalledWith(12, expect.objectContaining({ estado: 'EN_PROGRESO', objetivoId: 1 })))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('«Escapada a Mendoza» ahora es parte de «Salud»'))
  })

  it('los candidatos son solo los proyectos abiertos que no son ya del objetivo', async () => {
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    const filas = within(dialogo).getAllByRole('button', { name: /Escapada a Mendoza|Proyecto suelto|Plan de entrenamiento|Chequeo médico|Proyecto cerrado/ })
    expect(filas.map((f) => f.querySelector('span')?.textContent)).toEqual(['Escapada a Mendoza', 'Proyecto suelto'])
  })

  it('un 400 del servidor queda dentro del diálogo, que sigue abierto, y no avisa', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValue(new ApiError(400, 'La solicitud no es válida.'))
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    await user.click(within(dialogo).getByRole('button', { name: /Proyecto suelto/ }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La solicitud no es válida.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('status', { hidden: true })).toBeEmptyDOMElement()
    expect(within(seccion()).queryByRole('link', { name: 'Proyecto suelto', hidden: true })).not.toBeInTheDocument()
  })

  it('un 404 también queda en el diálogo y refresca las listas', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValue(new ApiError(404, 'No existe el proyecto 13'))
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    const antes = vi.mocked(getProyectos).mock.calls.length
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    await user.click(within(dialogo).getByRole('button', { name: /Proyecto suelto/ }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No existe el proyecto 13')
    await waitFor(() => expect(vi.mocked(getProyectos).mock.calls.length).toBeGreaterThan(antes))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancelar y volver a abrir no arrastra el error anterior', async () => {
    vi.mocked(actualizarProyecto).mockRejectedValueOnce(new ApiError(400, 'La solicitud no es válida.'))
    const user = await abrirSalud()
    let dialogo = await abrirEleccion(user)
    await user.click(within(dialogo).getByRole('button', { name: 'Vincular uno existente' }))
    await user.click(within(dialogo).getByRole('button', { name: /Proyecto suelto/ }))
    await within(dialogo).findByRole('alert')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialogo = await abrirEleccion(user)
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con la lista de proyectos cargando, «Vincular» está deshabilitado con su nota y «Crear» sigue disponible', async () => {
    vi.mocked(getProyectos).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderizar('/objetivos/1')
    await screen.findByRole('heading', { name: 'Salud', level: 1 })
    await user.click(screen.getByRole('button', { name: 'Agregar proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('button', { name: 'Vincular uno existente' })).toBeDisabled()
    expect(within(dialogo).getByText('Cargando proyectos…')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Crear uno nuevo' })).toBeEnabled()
  })

  it('con la lista de proyectos fallida, «Vincular» está deshabilitado con su nota y «Crear» sigue disponible', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor'))
    const user = userEvent.setup()
    renderizar('/objetivos/1')
    await screen.findByRole('heading', { name: 'Salud', level: 1 })
    await within(seccion()).findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Agregar proyecto' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('button', { name: 'Vincular uno existente' })).toBeDisabled()
    expect(within(dialogo).getByText('No se pudo cargar la lista de proyectos')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Crear uno nuevo' })).toBeEnabled()
  })

  it('sin candidatos lo dice y deshabilita «Vincular»', async () => {
    proyectos = [proyecto({ id: 10, nombre: 'Plan de entrenamiento', objetivoId: 1 })]
    const user = await abrirSalud()
    const dialogo = await abrirEleccion(user)
    expect(within(dialogo).getByText('No hay otros proyectos abiertos.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Vincular uno existente' })).toBeDisabled()
  })

  it('en un objetivo cerrado no se ofrece «Agregar proyecto»', async () => {
    await abrirSalud(4, 'Archivado')
    expect(screen.queryByRole('button', { name: 'Agregar proyecto' })).not.toBeInTheDocument()
  })
})

describe('ObjetivoPage: crear un proyecto nuevo desde el objetivo', () => {
  it('abre el formulario con el objetivo prefijado, lo manda en el POST y avisa como siempre', async () => {
    const user = await abrirSalud()
    const eleccion = await abrirEleccion(user)
    await user.click(within(eleccion).getByRole('button', { name: 'Crear uno nuevo' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo proyecto' })
    expect(within(dialogo).getByRole('combobox', { name: 'Objetivo' })).toHaveValue('1')
    expect(within(dialogo).getByRole('option', { name: 'Salud' })).toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Correr una maratón')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(crearProyecto).toHaveBeenCalledWith({
        nombre: 'Correr una maratón',
        descripcion: null,
        estado: 'PENDIENTE',
        prioridad: null,
        padreId: null,
        objetivoId: 1,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Proyecto «Correr una maratón» creado')
    expect(await within(seccion()).findByRole('link', { name: 'Correr una maratón' })).toBeInTheDocument()
  })
})
