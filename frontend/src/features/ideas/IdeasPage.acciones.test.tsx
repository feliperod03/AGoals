import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { objetivo, proyecto } from '@/features/jerarquia/fabrica'
import { renderizarIdeas } from '@/test/renderIdeas'
import type { Idea } from '@/types/idea'
import { idea } from './fabrica'

vi.mock('@/api/ideas', () => ({ getIdeas: vi.fn(), crearIdea: vi.fn(), actualizarIdea: vi.fn(), concluirIdea: vi.fn(), reabrirIdea: vi.fn(), borrarIdea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn(), crearProyecto: vi.fn(), actualizarProyecto: vi.fn(), borrarProyecto: vi.fn(), getImpactoBorradoProyecto: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn(), crearObjetivo: vi.fn(), actualizarObjetivo: vi.fn(), borrarObjetivo: vi.fn(), getImpactoBorradoObjetivo: vi.fn() }))
import { actualizarIdea, borrarIdea, concluirIdea, crearIdea, getIdeas, reabrirIdea } from '@/api/ideas'
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

type Usuario = ReturnType<typeof userEvent.setup>

// Un "servidor" en memoria: las mutaciones lo cambian y la lista que se vuelve a pedir lo refleja.
let datos: Idea[]

beforeEach(() => {
  datos = [
    idea({ id: 1, titulo: 'Primera', fechaCreacion: '2026-11-01T10:00:00-03:00' }),
    idea({ id: 2, titulo: 'Reabierta', conclusion: 'Salió bien', proyectoId: 5, fechaCreacion: '2026-11-02T10:00:00-03:00' }),
    idea({ id: 3, titulo: 'Cerrada', estado: 'CONCLUIDA', conclusion: 'Vieja', objetivoId: 8, fechaCreacion: '2026-11-03T10:00:00-03:00', fechaCierre: '2026-11-04T10:00:00-03:00' }),
  ]
  vi.mocked(getIdeas).mockImplementation(async () => datos.map((d) => ({ ...d })))
  vi.mocked(getProyectos).mockResolvedValue([proyecto({ id: 5, nombre: 'Casa' }), proyecto({ id: 6, nombre: 'Huerta' })])
  vi.mocked(getObjetivos).mockResolvedValue([objetivo({ id: 8, nombre: 'Salud' }), objetivo({ id: 9, nombre: 'Viajes' })])
  vi.mocked(crearIdea).mockImplementation(async (r) => {
    const nueva = idea({ ...r, id: 100, fechaCreacion: '2026-11-10T09:00:00-03:00' })
    datos.push(nueva)
    return nueva
  })
  vi.mocked(actualizarIdea).mockImplementation(async (id, r) => {
    datos = datos.map((d) => (d.id === id ? { ...d, ...r } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(concluirIdea).mockImplementation(async (id, conclusion) => {
    datos = datos.map((d) => (d.id === id ? { ...d, estado: 'CONCLUIDA', fechaCierre: '2026-11-10T10:00:00-03:00', conclusion: conclusion ?? d.conclusion } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(reabrirIdea).mockImplementation(async (id) => {
    datos = datos.map((d) => (d.id === id ? { ...d, estado: 'PLANTEADA', fechaCierre: null } : d))
    return datos.find((d) => d.id === id)!
  })
  vi.mocked(borrarIdea).mockImplementation(async (id) => {
    datos = datos.filter((d) => d.id !== id)
  })
})
afterEach(() => vi.resetAllMocks())

const aviso = () => screen.getByRole('status')
const titulos = () => screen.queryAllByRole('button', { name: /^Acciones de «/ }).map((b) => /«(.*)»/.exec(b.getAttribute('aria-label') ?? '')?.[1])
const NUNCA = () => new Promise<never>(() => {})

async function iniciar() {
  const user = userEvent.setup()
  const queryClient = renderizarIdeas()
  await screen.findByText('Primera')
  return { user, queryClient }
}

async function verTodas(user: Usuario) {
  await user.selectOptions(screen.getByLabelText('Estado'), 'todas')
}

async function abrirMenu(user: Usuario, titulo: string, opcion: string) {
  await user.click(await screen.findByRole('button', { name: `Acciones de «${titulo}»` }))
  await user.click(await screen.findByRole('menuitem', { name: opcion }))
  return screen.findByRole('dialog')
}

async function abrirCrear(user: Usuario) {
  await user.click(screen.getByRole('button', { name: 'Nueva idea' }))
  return screen.findByRole('dialog')
}

/** Elige proyecto u objetivo en el diálogo: radio, «Elegir/Cambiar» y la fila con ese nombre. */
async function elegirVinculo(user: Usuario, dialogo: HTMLElement, tipo: 'Proyecto' | 'Objetivo', nombre: string) {
  await user.click(within(dialogo).getByRole('radio', { name: tipo }))
  await user.click(within(dialogo).getByRole('button', { name: /^(Elegir|Cambiar)$/ }))
  await user.click(within(dialogo).getByRole('button', { name: new RegExp(nombre) }))
}

describe('IdeasPage: crear', () => {
  it('crea una idea suelta con los cinco campos, avisa y la muestra', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    expect(within(dialogo).getByRole('heading', { name: 'Nueva idea' })).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText('Conclusión')).not.toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Título'), '  Aprender a nadar  ')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearIdea).toHaveBeenCalledTimes(1))
    expect(crearIdea).toHaveBeenCalledWith({ titulo: 'Aprender a nadar', descripcion: null, proyectoId: null, objetivoId: null, conclusion: null })
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Aprender a nadar» creada'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Acciones de «Aprender a nadar»' })).toBeInTheDocument()
  })

  it('crea con descripción y ligada a un proyecto', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Pintar')
    await user.type(within(dialogo).getByLabelText('Descripción'), 'De blanco')
    await elegirVinculo(user, dialogo, 'Proyecto', 'Huerta')
    expect(within(dialogo).getByTestId('vinculo-actual')).toHaveTextContent('«Huerta»')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearIdea).toHaveBeenCalledTimes(1))
    expect(crearIdea).toHaveBeenCalledWith({ titulo: 'Pintar', descripcion: 'De blanco', proyectoId: 6, objetivoId: null, conclusion: null })
  })

  it('crea ligada a un objetivo', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Viajar')
    await elegirVinculo(user, dialogo, 'Objetivo', 'Viajes')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearIdea).toHaveBeenCalledTimes(1))
    expect(crearIdea).toHaveBeenCalledWith({ titulo: 'Viajar', descripcion: null, proyectoId: null, objetivoId: 9, conclusion: null })
  })

  it('cambiar de proyecto a objetivo no arrastra el proyecto: nunca van los dos', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Mixta')
    await elegirVinculo(user, dialogo, 'Proyecto', 'Casa')
    await elegirVinculo(user, dialogo, 'Objetivo', 'Salud')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crearIdea).toHaveBeenCalledTimes(1))
    expect(crearIdea).toHaveBeenCalledWith({ titulo: 'Mixta', descripcion: null, proyectoId: null, objetivoId: 8, conclusion: null })
  })

  it('elegir «Proyecto» sin elegir uno bloquea el envío', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Algo')
    await user.click(within(dialogo).getByRole('radio', { name: 'Proyecto' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByText('Elige un proyecto')).toBeInTheDocument()
    expect(crearIdea).not.toHaveBeenCalled()
  })

  it('valida el título: vacío, solo espacios y 201 caracteres no llaman a la API', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    const titulo = within(dialogo).getByLabelText('Título')
    const guardar = within(dialogo).getByRole('button', { name: 'Guardar' })

    await user.click(guardar)
    expect(await within(dialogo).findByText('El título es obligatorio')).toBeInTheDocument()

    await user.type(titulo, '     ')
    await user.click(guardar)
    expect(await within(dialogo).findByText('El título es obligatorio')).toBeInTheDocument()

    await user.clear(titulo)
    await user.click(titulo)
    await user.paste('x'.repeat(201))
    await user.click(guardar)
    expect(await within(dialogo).findByText('El título admite como máximo 200 caracteres')).toBeInTheDocument()

    expect(crearIdea).not.toHaveBeenCalled()
    expect(dialogo).toBeInTheDocument()
  })

  it('200 caracteres justos sí se guardan', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.click(within(dialogo).getByLabelText('Título'))
    await user.paste('x'.repeat(200))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(crearIdea).toHaveBeenCalledTimes(1))
  })
})

describe('IdeasPage: editar', () => {
  it('edita una idea suelta y manda los cinco campos', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Editar')
    expect(within(dialogo).getByRole('heading', { name: 'Editar idea' })).toBeInTheDocument()
    const titulo = within(dialogo).getByLabelText('Título')
    await user.clear(titulo)
    await user.type(titulo, 'Primera editada')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(1, { titulo: 'Primera editada', descripcion: null, proyectoId: null, objetivoId: null, conclusion: null })
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Primera editada» guardada'))
    expect(await screen.findByRole('button', { name: 'Acciones de «Primera editada»' })).toBeInTheDocument()
  })

  it('REGRESIÓN: una idea reabierta conserva su conclusión y su vínculo en el PUT aunque solo cambie el título', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    // La conclusión se ve y se puede editar porque la idea ya tiene una.
    expect(within(dialogo).getByLabelText('Conclusión')).toHaveValue('Salió bien')
    const titulo = within(dialogo).getByLabelText('Título')
    await user.clear(titulo)
    await user.type(titulo, 'Reabierta v2')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(2, { titulo: 'Reabierta v2', descripcion: null, proyectoId: 5, objetivoId: null, conclusion: 'Salió bien' })
  })

  it('una idea planteada sin conclusión no muestra el campo y manda conclusion null', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Editar')
    expect(within(dialogo).queryByLabelText('Conclusión')).not.toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(vi.mocked(actualizarIdea).mock.calls[0]?.[1].conclusion).toBeNull()
  })

  it('una idea concluida permite cambiar o vaciar la conclusión; el PUT no cambia su estado', async () => {
    const { user } = await iniciar()
    await verTodas(user)
    const dialogo = await abrirMenu(user, 'Cerrada', 'Editar')
    const conclusion = within(dialogo).getByLabelText('Conclusión')
    expect(conclusion).toHaveValue('Vieja')
    await user.clear(conclusion)
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(3, { titulo: 'Cerrada', descripcion: null, proyectoId: null, objetivoId: 8, conclusion: null })
    expect(Object.keys(vi.mocked(actualizarIdea).mock.calls[0]?.[1] ?? {}).sort()).toEqual(['conclusion', 'descripcion', 'objetivoId', 'proyectoId', 'titulo'])
  })

  it('pasar de un proyecto a un objetivo manda solo el objetivo', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    expect(within(dialogo).getByTestId('vinculo-actual')).toHaveTextContent('«Casa»')
    await elegirVinculo(user, dialogo, 'Objetivo', 'Viajes')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(2, expect.objectContaining({ proyectoId: null, objetivoId: 9, conclusion: 'Salió bien' }))
  })

  it('soltar el vínculo con «Ninguno» manda los dos en null', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    await user.click(within(dialogo).getByRole('radio', { name: 'Ninguno' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(2, expect.objectContaining({ proyectoId: null, objetivoId: null }))
  })

  it('Cancelar cierra sin llamar a la API', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(actualizarIdea).not.toHaveBeenCalled()
  })
})

describe('IdeasPage: errores al guardar', () => {
  it('400 (vínculo inexistente): el diálogo queda abierto con el mensaje y se refrescan las listas', async () => {
    vi.mocked(actualizarIdea).mockRejectedValue(new ApiError(400, 'El proyecto no existe: 5'))
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    const antes = vi.mocked(getProyectos).mock.calls.length
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El proyecto no existe: 5')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(getProyectos).mock.calls.length).toBeGreaterThan(antes))
  })

  it('404 (borrada en otra pestaña): mensaje en el diálogo y la lista se refresca', async () => {
    vi.mocked(actualizarIdea).mockImplementation(async () => {
      datos = datos.filter((d) => d.id !== 1)
      throw new ApiError(404, 'No existe la idea 1')
    })
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Editar')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No existe la idea 1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('fallo de red: mensaje legible y el diálogo conserva lo escrito', async () => {
    vi.mocked(crearIdea).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.'))
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Nueva')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor')
    expect(within(dialogo).getByLabelText('Título')).toHaveValue('Nueva')
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('durante el guardado los botones se deshabilitan y un doble clic hace una sola llamada', async () => {
    vi.mocked(crearIdea).mockImplementation(NUNCA)
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await user.type(within(dialogo).getByLabelText('Título'), 'Doble')
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Guardando…' })).toBeDisabled())
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(within(dialogo).getByRole('radio', { name: 'Proyecto' })).toBeDisabled()
    expect(crearIdea).toHaveBeenCalledTimes(1)
  })
})

describe('IdeasPage: proyectos y objetivos cargando o fallidos', () => {
  it('al crear con la lista de proyectos fallida: el radio «Proyecto» queda deshabilitado, con nota, y se puede crear suelta', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(0, 'sin conexión'))
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    await waitFor(() => expect(within(dialogo).getByRole('radio', { name: 'Proyecto' })).toBeDisabled())
    expect(within(dialogo).getByRole('radio', { name: 'Objetivo' })).toBeEnabled()
    expect(within(dialogo).getByText('No se pudo cargar la lista de proyectos.')).toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Título'), 'Sin lista')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(crearIdea).toHaveBeenCalledWith({ titulo: 'Sin lista', descripcion: null, proyectoId: null, objetivoId: null, conclusion: null }))
  })

  it('mientras cargan, ambos radios de vínculo están deshabilitados con la nota «Cargando…»', async () => {
    vi.mocked(getProyectos).mockImplementation(NUNCA)
    vi.mocked(getObjetivos).mockImplementation(NUNCA)
    const { user } = await iniciar()
    const dialogo = await abrirCrear(user)
    expect(within(dialogo).getByRole('radio', { name: 'Proyecto' })).toBeDisabled()
    expect(within(dialogo).getByRole('radio', { name: 'Objetivo' })).toBeDisabled()
    expect(within(dialogo).getByText(/Cargando proyectos…/)).toBeInTheDocument()
  })

  it('al editar una idea ligada con la lista fallida, el vínculo no se puede tocar y el PUT reenvía el original', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(0, 'sin conexión'))
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Cambiar' })).toBeDisabled())
    expect(within(dialogo).getByRole('radio', { name: 'Ninguno' })).toBeDisabled()
    expect(within(dialogo).getByRole('radio', { name: 'Objetivo' })).toBeDisabled()
    // Sin lista no hay nombre: se rotula con el número.
    expect(within(dialogo).getByTestId('vinculo-actual')).toHaveTextContent('«n.º 5»')
    expect(within(dialogo).getByText(/Se conserva el vínculo actual/)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarIdea).toHaveBeenCalledTimes(1))
    expect(actualizarIdea).toHaveBeenCalledWith(2, expect.objectContaining({ proyectoId: 5, objetivoId: null }))
  })

  it('al editar una idea ligada mientras la lista carga, «Cambiar» está deshabilitado', async () => {
    vi.mocked(getProyectos).mockImplementation(NUNCA)
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Editar')
    expect(within(dialogo).getByRole('button', { name: 'Cambiar' })).toBeDisabled()
  })
})

describe('IdeasPage: concluir', () => {
  it('«Concluir» solo está en las planteadas y «Reabrir» solo en las concluidas', async () => {
    const { user } = await iniciar()
    await verTodas(user)
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Primera»' }))
    expect(await screen.findByRole('menuitem', { name: 'Concluir' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Reabrir' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Cerrada»' }))
    expect(await screen.findByRole('menuitem', { name: 'Reabrir' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Concluir' })).not.toBeInTheDocument()
  })

  it('con conclusión: la manda, avisa y la idea sale de «Planteadas»', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Concluir')
    expect(within(dialogo).getByText('Si la dejas vacía se conserva la conclusión anterior, si la hay.')).toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Conclusión (opcional)'), 'Lo logré')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    await waitFor(() => expect(concluirIdea).toHaveBeenCalledWith(1, 'Lo logré'))
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Primera» concluida'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('sin conclusión: la llamada no lleva texto (el backend conserva la anterior)', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Reabierta', 'Concluir')
    await user.type(within(dialogo).getByLabelText('Conclusión (opcional)'), '   ')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(concluirIdea).toHaveBeenCalledTimes(1))
    expect(concluirIdea).toHaveBeenCalledWith(2, undefined)
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Reabierta» concluida'))
  })

  it('409 (ya concluida en otra pestaña): muestra el mensaje, deja el diálogo abierto y refresca la lista', async () => {
    vi.mocked(concluirIdea).mockImplementation(async (id) => {
      datos = datos.map((d) => (d.id === id ? { ...d, estado: 'CONCLUIDA', fechaCierre: '2026-11-10T08:00:00-03:00' } : d))
      throw new ApiError(409, 'La idea 1 ya está concluida')
    })
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Concluir')
    const pedidos = vi.mocked(getIdeas).mock.calls.length
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La idea 1 ya está concluida')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Concluir' })).toBeEnabled()
    await waitFor(() => expect(vi.mocked(getIdeas).mock.calls.length).toBeGreaterThan(pedidos))
    // La lista refrescada ya no la tiene entre las planteadas.
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('404 (idea borrada en otra pestaña): mensaje en el diálogo y refresco', async () => {
    vi.mocked(concluirIdea).mockImplementation(async () => {
      datos = datos.filter((d) => d.id !== 1)
      throw new ApiError(404, 'No existe la idea 1')
    })
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Concluir')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No existe la idea 1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('fallo de red: mensaje legible y el diálogo sigue abierto', async () => {
    vi.mocked(concluirIdea).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Concluir')
    await user.type(within(dialogo).getByLabelText('Conclusión (opcional)'), 'Texto')
    await user.click(within(dialogo).getByRole('button', { name: 'Concluir' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
    expect(within(dialogo).getByLabelText('Conclusión (opcional)')).toHaveValue('Texto')
  })

  it('durante la llamada los botones se deshabilitan y un doble clic hace una sola llamada', async () => {
    vi.mocked(concluirIdea).mockImplementation(NUNCA)
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Concluir')
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Concluyendo…' })).toBeDisabled())
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(concluirIdea).toHaveBeenCalledTimes(1)
  })
})

describe('IdeasPage: reabrir', () => {
  it('reabre directo, avisa y la conclusión se conserva a la vista', async () => {
    const { user } = await iniciar()
    await user.selectOptions(screen.getByLabelText('Estado'), 'concluidas')
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Cerrada»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reabrir' }))

    await waitFor(() => expect(reabrirIdea).toHaveBeenCalledWith(3))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Cerrada» reabierta'))
    await verTodas(user)
    const fila = (await screen.findByText('Cerrada')).closest('li')!
    await waitFor(() => expect(within(fila).getByText('Planteada')).toBeInTheDocument())
    expect(fila).toHaveTextContent('Conclusión: Vieja')
  })

  it('404: el error se ve en la página y la lista se refresca', async () => {
    vi.mocked(reabrirIdea).mockImplementation(async () => {
      datos = datos.filter((d) => d.id !== 3)
      throw new ApiError(404, 'No existe la idea 3')
    })
    const { user } = await iniciar()
    await verTodas(user)
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Cerrada»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reabrir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No existe la idea 3')
    await waitFor(() => expect(titulos()).not.toContain('Cerrada'))
  })

  it('fallo de red: error legible en la página', async () => {
    vi.mocked(reabrirIdea).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const { user } = await iniciar()
    await verTodas(user)
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Cerrada»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reabrir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })

  it('mientras reabre, los menús quedan deshabilitados', async () => {
    vi.mocked(reabrirIdea).mockImplementation(NUNCA)
    const { user } = await iniciar()
    await verTodas(user)
    await user.click(await screen.findByRole('button', { name: 'Acciones de «Cerrada»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Reabrir' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones de «Primera»' })).toBeDisabled())
    expect(reabrirIdea).toHaveBeenCalledTimes(1)
  })
})

describe('IdeasPage: borrar', () => {
  it('confirma el borrado: DELETE sin parámetros, aviso y la fila desaparece', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Borrar')
    expect(within(dialogo).getByRole('heading', { name: 'Borrar idea' })).toBeInTheDocument()
    expect(dialogo).toHaveTextContent('¿Borrar la idea «Primera»?')
    expect(dialogo).toHaveTextContent('definitivo')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))

    await waitFor(() => expect(borrarIdea).toHaveBeenCalledTimes(1))
    expect(borrarIdea).toHaveBeenCalledWith(1)
    await waitFor(() => expect(aviso()).toHaveTextContent('Idea «Primera» borrada'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('Cancelar no llama a la API', async () => {
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(borrarIdea).not.toHaveBeenCalled()
    expect(titulos()).toContain('Primera')
  })

  it('404 (ya borrada en otra pestaña): mensaje en el diálogo, queda abierto y la lista se refresca', async () => {
    vi.mocked(borrarIdea).mockImplementation(async () => {
      datos = datos.filter((d) => d.id !== 1)
      throw new ApiError(404, 'No existe la idea 1')
    })
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No existe la idea 1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(titulos()).not.toContain('Primera'))
  })

  it('fallo de red: mensaje legible y el diálogo sigue abierto', async () => {
    vi.mocked(borrarIdea).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Borrar')
    await user.click(within(dialogo).getByRole('button', { name: 'Borrar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
    expect(within(dialogo).getByRole('button', { name: 'Borrar' })).toBeEnabled()
    expect(borrarIdea).toHaveBeenCalledTimes(1)
    expect(datos.map((d) => d.titulo)).toContain('Primera')
  })

  it('durante la llamada los botones se deshabilitan y un doble clic hace una sola llamada', async () => {
    vi.mocked(borrarIdea).mockImplementation(NUNCA)
    const { user } = await iniciar()
    const dialogo = await abrirMenu(user, 'Primera', 'Borrar')
    await user.dblClick(within(dialogo).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Borrando…' })).toBeDisabled())
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(borrarIdea).toHaveBeenCalledTimes(1)
  })
})
