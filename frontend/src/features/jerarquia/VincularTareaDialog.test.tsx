import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import type { Tarea } from '@/types/tarea'
import { objetivo, proyecto } from './fabrica'
import { VincularTareaDialog } from './VincularTareaDialog'

vi.mock('@/api/tareas', () => ({ getTareas: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
import { asignarTarea as asignarObjetivo, getObjetivos, quitarTarea as quitarObjetivo } from '@/api/objetivos'
import { asignarTarea as asignarProyecto, getProyectos, quitarTarea as quitarProyecto } from '@/api/proyectos'
import { getTareas } from '@/api/tareas'

const PROYECTOS = [
  proyecto({ id: 5, nombre: 'Casa nueva' }),
  proyecto({ id: 7, nombre: 'Mudanza' }),
  proyecto({ id: 8, nombre: 'Terminado', estado: 'HECHO' }),
]
const OBJETIVOS = [objetivo({ id: 3, nombre: 'Vivir solo' }), objetivo({ id: 4, nombre: 'Salud' })]

/** Lo que "tiene" el servidor: los mocks de asignar/quitar lo modifican, así el refresco muestra lo nuevo. */
let servidor: Tarea

function renderizar(inicial: Partial<Tarea> = {}) {
  servidor = tarea({ id: 12, titulo: 'Embalar', ...inicial })
  vi.mocked(getTareas).mockImplementation(async () => [servidor])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const alMensaje = vi.fn()
  const alCerrar = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <VincularTareaDialog tarea={servidor} alCerrar={alCerrar} alMensaje={alMensaje} />
    </QueryClientProvider>,
  )
  return { alMensaje, alCerrar }
}

const dialogo = () => screen.findByRole('dialog', { name: 'Proyecto y objetivo de «Embalar»' })
const campo = (d: HTMLElement, nombre: 'Proyecto' | 'Objetivo') => within(within(d).getByRole('heading', { name: nombre }).closest('section') as HTMLElement)

async function listo(d: HTMLElement) {
  await waitFor(() => expect(within(d).getByRole('button', { name: 'Cambiar proyecto' })).toBeEnabled())
  await waitFor(() => expect(within(d).getByRole('button', { name: 'Cambiar objetivo' })).toBeEnabled())
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
  vi.mocked(getObjetivos).mockResolvedValue(OBJETIVOS)
  vi.mocked(asignarProyecto).mockImplementation(async (id, tareaId) => {
    servidor = { ...servidor, proyectoId: id }
    return { ...servidor, id: tareaId }
  })
  vi.mocked(asignarObjetivo).mockImplementation(async (id, tareaId) => {
    servidor = { ...servidor, objetivoId: id }
    return { ...servidor, id: tareaId }
  })
  vi.mocked(quitarProyecto).mockImplementation(async () => {
    servidor = { ...servidor, proyectoId: null }
  })
  vi.mocked(quitarObjetivo).mockImplementation(async () => {
    servidor = { ...servidor, objetivoId: null }
  })
})

describe('VincularTareaDialog: mostrar', () => {
  it('muestra el proyecto y el objetivo actuales, o «Sin …»', async () => {
    renderizar({ proyectoId: 7 })
    const d = await dialogo()
    await listo(d)
    expect(campo(d, 'Proyecto').getByText('Mudanza')).toBeInTheDocument()
    expect(campo(d, 'Objetivo').getByText('Sin objetivo')).toBeInTheDocument()
    expect(campo(d, 'Proyecto').getByRole('button', { name: 'Quitar proyecto' })).toBeInTheDocument()
    expect(campo(d, 'Objetivo').queryByRole('button', { name: 'Quitar objetivo' })).not.toBeInTheDocument()
  })

  it('si el nombre no está en la lista usa «n.º N»', async () => {
    renderizar({ objetivoId: 99 })
    const d = await dialogo()
    await listo(d)
    expect(campo(d, 'Objetivo').getByText('n.º 99')).toBeInTheDocument()
  })

  it('el buscador ofrece los abiertos más el actual aunque esté cerrado', async () => {
    renderizar({ proyectoId: 8 })
    const d = await dialogo()
    await listo(d)
    await userEvent.setup().click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    const lista = campo(d, 'Proyecto').getAllByRole('button').map((b) => b.textContent)
    expect(lista.some((t) => t?.startsWith('Terminado'))).toBe(true)
    expect(lista.some((t) => t?.startsWith('Mudanza'))).toBe(true)
    expect(lista.some((t) => t?.startsWith('Casa nueva'))).toBe(true)
  })
})

describe('VincularTareaDialog: éxito', () => {
  it('asignar un proyecto: PUT, aviso, cierra el buscador y el campo muestra el nuevo; el objetivo no se toca', async () => {
    const user = userEvent.setup()
    const { alMensaje, alCerrar } = renderizar({ objetivoId: 3 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    // Sin proyecto actual no hay aviso de «se moverá».
    expect(within(d).queryByText(/al elegir otro se moverá/)).not.toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: /^Mudanza/ }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ahora es del proyecto «Mudanza»'))
    expect(asignarProyecto).toHaveBeenCalledWith(7, 12)
    expect(asignarObjetivo).not.toHaveBeenCalled()
    expect(quitarObjetivo).not.toHaveBeenCalled()
    await waitFor(() => expect(campo(d, 'Proyecto').getByText('Mudanza')).toBeInTheDocument())
    expect(within(d).queryByLabelText('Buscar proyecto')).not.toBeInTheDocument()
    expect(campo(d, 'Objetivo').getByText('Vivir solo')).toBeInTheDocument()
    expect(alCerrar).not.toHaveBeenCalled()
  })

  it('reasignar: avisa que se moverá y reemplaza el proyecto', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar({ proyectoId: 5 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    expect(within(d).getByText('Ahora es del proyecto «Casa nueva»; al elegir otro se moverá.')).toBeInTheDocument()
    await user.click(within(d).getByRole('button', { name: /^Mudanza/ }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ahora es del proyecto «Mudanza»'))
    expect(asignarProyecto).toHaveBeenCalledWith(7, 12)
    await waitFor(() => expect(campo(d, 'Proyecto').getByText('Mudanza')).toBeInTheDocument())
  })

  it('asignar un objetivo usa la API de objetivos y no toca el proyecto', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar({ proyectoId: 5 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar objetivo' }))
    await user.click(within(d).getByRole('button', { name: /^Salud/ }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ahora es del objetivo «Salud»'))
    expect(asignarObjetivo).toHaveBeenCalledWith(4, 12)
    expect(asignarProyecto).not.toHaveBeenCalled()
    expect(quitarProyecto).not.toHaveBeenCalled()
    await waitFor(() => expect(campo(d, 'Proyecto').getByText('Casa nueva')).toBeInTheDocument())
  })

  it('quitar el proyecto: DELETE, aviso, y el objetivo se conserva', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar({ proyectoId: 5, objetivoId: 3 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Quitar proyecto' }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ya no es del proyecto «Casa nueva»'))
    expect(quitarProyecto).toHaveBeenCalledWith(5, 12)
    expect(quitarObjetivo).not.toHaveBeenCalled()
    await waitFor(() => expect(campo(d, 'Proyecto').getByText('Sin proyecto')).toBeInTheDocument())
    expect(campo(d, 'Objetivo').getByText('Vivir solo')).toBeInTheDocument()
  })

  it('quitar el objetivo: DELETE a objetivos y aviso', async () => {
    const user = userEvent.setup()
    const { alMensaje } = renderizar({ proyectoId: 5, objetivoId: 3 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Quitar objetivo' }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ya no es del objetivo «Vivir solo»'))
    expect(quitarObjetivo).toHaveBeenCalledWith(3, 12)
    expect(quitarProyecto).not.toHaveBeenCalled()
  })

  it('elegir el proyecto que ya tiene no hace ninguna llamada y cierra el buscador', async () => {
    const user = userEvent.setup()
    renderizar({ proyectoId: 5 })
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    await user.click(within(d).getByRole('button', { name: /^Casa nueva/ }))
    expect(asignarProyecto).not.toHaveBeenCalled()
    expect(within(d).queryByLabelText('Buscar proyecto')).not.toBeInTheDocument()
  })

  it('solo hay un buscador abierto a la vez', async () => {
    const user = userEvent.setup()
    renderizar()
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    await user.click(within(d).getByRole('button', { name: 'Cambiar objetivo' }))
    expect(within(d).queryByLabelText('Buscar proyecto')).not.toBeInTheDocument()
    expect(within(d).getByLabelText('Buscar objetivo')).toBeInTheDocument()
  })
})

describe('VincularTareaDialog: errores', () => {
  it('400 al quitar: muestra el mensaje, sigue abierto y refresca las tareas', async () => {
    vi.mocked(quitarProyecto).mockRejectedValue(new ApiError(400, 'La tarea 12 no pertenece al proyecto 5'))
    const user = userEvent.setup()
    const { alMensaje, alCerrar } = renderizar({ proyectoId: 5 })
    const d = await dialogo()
    await listo(d)
    const antes = vi.mocked(getTareas).mock.calls.length
    await user.click(within(d).getByRole('button', { name: 'Quitar proyecto' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent('La tarea 12 no pertenece al proyecto 5')
    await waitFor(() => expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThan(antes))
    expect(alMensaje).not.toHaveBeenCalled()
    expect(alCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('404 al asignar (proyecto borrado): el buscador sigue abierto con el error y se refrescan tareas y proyectos', async () => {
    vi.mocked(asignarProyecto).mockRejectedValue(new ApiError(404, 'No existe el proyecto 7'))
    const user = userEvent.setup()
    const { alMensaje } = renderizar()
    const d = await dialogo()
    await listo(d)
    const tareasAntes = vi.mocked(getTareas).mock.calls.length
    const proyectosAntes = vi.mocked(getProyectos).mock.calls.length
    await user.click(within(d).getByRole('button', { name: 'Cambiar proyecto' }))
    await user.click(within(d).getByRole('button', { name: /^Mudanza/ }))
    expect(await within(d).findByRole('alert')).toHaveTextContent('No existe el proyecto 7')
    expect(within(d).getByLabelText('Buscar proyecto')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(getTareas).mock.calls.length).toBeGreaterThan(tareasAntes))
    await waitFor(() => expect(vi.mocked(getProyectos).mock.calls.length).toBeGreaterThan(proyectosAntes))
    expect(alMensaje).not.toHaveBeenCalled()
  })

  it('fallo de red: mensaje legible y el diálogo sigue abierto', async () => {
    vi.mocked(asignarObjetivo).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.'))
    const user = userEvent.setup()
    const { alMensaje } = renderizar()
    const d = await dialogo()
    await listo(d)
    await user.click(within(d).getByRole('button', { name: 'Cambiar objetivo' }))
    await user.click(within(d).getByRole('button', { name: /^Salud/ }))
    expect(await within(d).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(within(d).getByLabelText('Buscar objetivo')).toBeInTheDocument()
    expect(alMensaje).not.toHaveBeenCalled()
  })

  it('con la lista de proyectos fallida: el campo se deshabilita, no hay llamadas y el objetivo sigue operativo', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    const user = userEvent.setup()
    renderizar({ proyectoId: 5, objetivoId: 3 })
    const d = await dialogo()
    await waitFor(() => expect(within(d).getByText('No se pudo cargar la lista de proyectos')).toBeInTheDocument())
    expect(within(d).getByRole('button', { name: 'Cambiar proyecto' })).toBeDisabled()
    expect(within(d).getByRole('button', { name: 'Quitar proyecto' })).toBeDisabled()
    await user.click(within(d).getByRole('button', { name: 'Quitar proyecto' }))
    expect(quitarProyecto).not.toHaveBeenCalled()
    expect(asignarProyecto).not.toHaveBeenCalled()
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Cambiar objetivo' })).toBeEnabled())
    expect(within(d).getByRole('button', { name: 'Quitar objetivo' })).toBeEnabled()
  })

  it('con la lista de objetivos fallida: el campo Objetivo se deshabilita y ninguna llamada sale', async () => {
    vi.mocked(getObjetivos).mockRejectedValue(new ApiError(0, 'Sin conexión'))
    renderizar({ objetivoId: 3 })
    const d = await dialogo()
    await waitFor(() => expect(within(d).getByText('No se pudo cargar la lista de objetivos')).toBeInTheDocument())
    expect(within(d).getByRole('button', { name: 'Cambiar objetivo' })).toBeDisabled()
    expect(within(d).getByRole('button', { name: 'Quitar objetivo' })).toBeDisabled()
    expect(quitarObjetivo).not.toHaveBeenCalled()
  })

  it('mientras la lista carga, el campo está deshabilitado', async () => {
    vi.mocked(getProyectos).mockReturnValue(new Promise(() => {}))
    renderizar({ proyectoId: 5 })
    const d = await dialogo()
    expect(within(d).getByText('Cargando proyectos…')).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Cambiar proyecto' })).toBeDisabled()
    expect(within(d).getByRole('button', { name: 'Quitar proyecto' })).toBeDisabled()
  })
})

describe('VincularTareaDialog: mutación en curso', () => {
  it('deshabilita todos los botones, no se cierra con Escape y un doble clic envía una sola llamada', async () => {
    let terminar: () => void = () => {}
    vi.mocked(quitarProyecto).mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminar = () => {
            servidor = { ...servidor, proyectoId: null }
            resolver()
          }
        }),
    )
    const user = userEvent.setup()
    const { alCerrar } = renderizar({ proyectoId: 5, objetivoId: 3 })
    const d = await dialogo()
    await listo(d)
    const quitar = within(d).getByRole('button', { name: 'Quitar proyecto' })
    // Dos clics seguidos, sin esperar entre medio.
    await Promise.all([user.click(quitar), user.click(quitar)])
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Cambiar proyecto' })).toBeDisabled())
    expect(quitarProyecto).toHaveBeenCalledTimes(1)
    for (const nombre of ['Cambiar proyecto', 'Quitar proyecto', 'Cambiar objetivo', 'Quitar objetivo', 'Listo']) {
      expect(within(d).getByRole('button', { name: nombre })).toBeDisabled()
    }
    await user.keyboard('{Escape}')
    expect(alCerrar).not.toHaveBeenCalled()
    terminar()
    await waitFor(() => expect(within(d).getByRole('button', { name: 'Listo' })).toBeEnabled())
    expect(quitarProyecto).toHaveBeenCalledTimes(1)
  })

  it('"Listo" y Escape cierran cuando no hay mutación', async () => {
    const user = userEvent.setup()
    const { alCerrar } = renderizar()
    const d = await dialogo()
    await user.click(within(d).getByRole('button', { name: 'Listo' }))
    expect(alCerrar).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(alCerrar).toHaveBeenCalledTimes(2)
  })
})
