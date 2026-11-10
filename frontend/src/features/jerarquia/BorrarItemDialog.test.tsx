import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Elecciones, ImpactoBorradoObjetivo, ImpactoBorradoProyecto } from '@/types/impactoBorrado'
import { BorrarItemDialog } from './BorrarItemDialog'
import { CONFIG_OBJETIVO, CONFIG_PROYECTO, type ConfigJerarquia } from './config'
import { objetivo, proyecto } from './fabrica'
import type { ItemJerarquico } from './tipos'
import { useAccionesJerarquia } from './useAccionesJerarquia'

vi.mock('@/api/proyectos', () => ({
  getProyectos: vi.fn(),
  crearProyecto: vi.fn(),
  actualizarProyecto: vi.fn(),
  borrarProyecto: vi.fn(),
  getImpactoBorradoProyecto: vi.fn(),
}))
vi.mock('@/api/objetivos', () => ({
  getObjetivos: vi.fn(),
  crearObjetivo: vi.fn(),
  actualizarObjetivo: vi.fn(),
  borrarObjetivo: vi.fn(),
  getImpactoBorradoObjetivo: vi.fn(),
}))
import { borrarObjetivo, getImpactoBorradoObjetivo } from '@/api/objetivos'
import { borrarProyecto, getImpactoBorradoProyecto } from '@/api/proyectos'

const VACIO = { total: 0, borrados: 0 }
const SIN_NADA_PROYECTO: ImpactoBorradoProyecto = { subproyectos: VACIO, tareas: VACIO, ideas: VACIO }
const SIN_NADA_OBJETIVO: ImpactoBorradoObjetivo = { subobjetivos: VACIO, proyectos: { ...VACIO, rescatados: 0 }, tareas: VACIO, ideas: VACIO }

/**
 * «Servidor» de la vista previa de un proyecto con 2 subproyectos y 2 tareas directas (3 con subtareas).
 * Borrar los subproyectos suma al alcance 3 tareas más y hace aparecer 1 idea.
 */
function impactoProyecto(e: Elecciones): ImpactoBorradoProyecto {
  const sub = e.subproyectos === 'borrar'
  return {
    subproyectos: { total: 2, borrados: sub ? 3 : 0 },
    tareas: { total: sub ? 5 : 2, borrados: e.tareas === 'borrar' ? (sub ? 8 : 3) : 0 },
    ideas: sub ? { total: 1, borrados: e.ideas === 'borrar' ? 1 : 0 } : VACIO,
  }
}

/** Objetivo con 3 proyectos (1 ligado a otro objetivo), 1 subobjetivo y 2 tareas. */
function impactoObjetivo(e: Elecciones): ImpactoBorradoObjetivo {
  return {
    subobjetivos: { total: 1, borrados: e.subobjetivos === 'borrar' ? 1 : 0 },
    proyectos: e.proyectos === 'borrar' ? { total: 3, borrados: 2, rescatados: 1 } : { total: 3, borrados: 0, rescatados: 0 },
    tareas: { total: 2, borrados: e.tareas === 'borrar' ? 2 : 0 },
    ideas: VACIO,
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

let queryClient: QueryClient

function Arnes<T extends ItemJerarquico, R>({ config, item }: { config: ConfigJerarquia<T, R>; item: T }) {
  const [mensaje, setMensaje] = useState('')
  const acciones = useAccionesJerarquia(config, { alMensaje: setMensaje, filtroEstado: 'todos' })
  return (
    <>
      <button type="button" onClick={() => acciones.pedirBorrado(item)}>
        Abrir
      </button>
      <p data-testid="aviso">{mensaje}</p>
      <BorrarItemDialog config={config} acciones={acciones} />
    </>
  )
}

async function abrir<T extends ItemJerarquico, R>(config: ConfigJerarquia<T, R>, item: T) {
  const user = userEvent.setup()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Arnes config={config} item={item} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return { user, dialogo: await screen.findByRole('dialog') }
}

const botonBorrar = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Borrar' })
const grupo = (dialogo: HTMLElement, nombre: string) => within(dialogo).getByRole('group', { name: nombre })

afterEach(() => vi.resetAllMocks())

describe('BorrarItemDialog: proyecto', () => {
  const casa = proyecto({ id: 1, nombre: 'Casa' })

  beforeEach(() => {
    vi.mocked(getImpactoBorradoProyecto).mockImplementation(async (_, e) => impactoProyecto(e ?? {}))
    vi.mocked(borrarProyecto).mockResolvedValue(undefined)
  })

  it('sin dependencias queda el diálogo simple y el DELETE va sin parámetros', async () => {
    vi.mocked(getImpactoBorradoProyecto).mockResolvedValue(SIN_NADA_PROYECTO)
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    expect(within(dialogo).getByText('¿Borrar «Casa»? No se puede deshacer.')).toBeInTheDocument()
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    expect(within(dialogo).queryByRole('group')).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('status')).not.toBeInTheDocument()

    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalledTimes(1))
    expect(vi.mocked(borrarProyecto).mock.calls[0]).toEqual([1])
    await waitFor(() => expect(screen.getByTestId('aviso')).toHaveTextContent('«Casa» borrado'))
    expect(screen.getByTestId('aviso').textContent).toBe('«Casa» borrado')
  })

  it('con dependencias muestra una fila por categoría con elementos, todo en Mover, y confirma conservar explícito', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const subproyectos = await within(dialogo).findByRole('group', { name: 'Subproyectos (2)' })
    expect(subproyectos).toBeInTheDocument()
    expect(grupo(dialogo, 'Tareas (2)')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('group', { name: /Ideas/ })).not.toBeInTheDocument()
    for (const g of [subproyectos, grupo(dialogo, 'Tareas (2)')]) {
      expect(within(g).getByRole('radio', { name: 'Mover' })).toBeChecked()
      expect(within(g).getByRole('radio', { name: 'Borrar' })).not.toBeChecked()
    }
    expect(within(subproyectos).getByText('Pasan al nivel superior')).toBeInTheDocument()
    expect(within(grupo(dialogo, 'Tareas (2)')).getByText('Quedan sueltas')).toBeInTheDocument()
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Solo se borrará «Casa».')

    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalledWith(1, { subproyectos: 'conservar', tareas: 'conservar' }))
  })

  it('cambiar un interruptor vuelve a pedir la vista previa y actualiza el resumen y la fila', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const tareas = await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    expect(getImpactoBorradoProyecto).toHaveBeenLastCalledWith(1, { subproyectos: 'conservar', tareas: 'conservar', ideas: 'conservar' })

    await user.click(within(tareas).getByRole('radio', { name: 'Borrar' }))
    await waitFor(() => expect(within(dialogo).getByRole('status')).toHaveTextContent('Se borrarán «Casa» y 3 tareas.'))
    expect(getImpactoBorradoProyecto).toHaveBeenLastCalledWith(1, { subproyectos: 'conservar', tareas: 'borrar', ideas: 'conservar' })
    expect(within(tareas).getByText('Se borran 3 tareas (incluye subtareas)')).toBeInTheDocument()

    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalledWith(1, { subproyectos: 'conservar', tareas: 'borrar' }))
    await waitFor(() => expect(screen.getByTestId('aviso')).toHaveTextContent('«Casa» borrado; también 3 tareas'))
  })

  it('mientras se pide la vista previa nueva se ve la anterior y confirmar queda deshabilitado', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const tareas = await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())

    const pendiente = deferred<ImpactoBorradoProyecto>()
    vi.mocked(getImpactoBorradoProyecto).mockReturnValueOnce(pendiente.promise)
    await user.click(within(tareas).getByRole('radio', { name: 'Borrar' }))

    await waitFor(() => expect(getImpactoBorradoProyecto).toHaveBeenCalledTimes(2))
    expect(botonBorrar(dialogo)).toBeDisabled()
    // Sin parpadeo: sigue la fila y el resumen de la elección anterior.
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Solo se borrará «Casa».')
    expect(grupo(dialogo, 'Tareas (2)')).toBeInTheDocument()
    await user.click(botonBorrar(dialogo))
    expect(borrarProyecto).not.toHaveBeenCalled()

    pendiente.resolve(impactoProyecto({ tareas: 'borrar' }))
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Se borrarán «Casa» y 3 tareas.')
  })

  it('una fila aparece tras otra elección, conserva su elección al desaparecer y solo se manda si es visible', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const subproyectos = await within(dialogo).findByRole('group', { name: 'Subproyectos (2)' })
    expect(within(dialogo).queryByRole('group', { name: /Ideas/ })).not.toBeInTheDocument()

    await user.click(within(subproyectos).getByRole('radio', { name: 'Borrar' }))
    const ideas = await within(dialogo).findByRole('group', { name: 'Ideas (1)' })
    // Con los subproyectos por borrar el alcance de las tareas crece.
    expect(grupo(dialogo, 'Tareas (5)')).toBeInTheDocument()

    await user.click(within(ideas).getByRole('radio', { name: 'Borrar' }))
    await waitFor(() => expect(within(dialogo).getByRole('status')).toHaveTextContent('Se borrarán «Casa», 3 subproyectos y 1 idea.'))

    // Vuelven los subproyectos a Mover: la fila de ideas desaparece...
    await user.click(within(grupo(dialogo, 'Subproyectos (2)')).getByRole('radio', { name: 'Mover' }))
    await waitFor(() => expect(within(dialogo).queryByRole('group', { name: /Ideas/ })).not.toBeInTheDocument())
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    // ...y el DELETE no la manda aunque la elección siga guardada.
    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalledWith(1, { subproyectos: 'conservar', tareas: 'conservar' }))
    expect(Object.keys(vi.mocked(borrarProyecto).mock.calls[0]?.[1] ?? {})).toEqual(['subproyectos', 'tareas'])
  })

  it('una fila que desaparece y reaparece conserva su elección', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const subproyectos = await within(dialogo).findByRole('group', { name: 'Subproyectos (2)' })
    await user.click(within(subproyectos).getByRole('radio', { name: 'Borrar' }))
    const ideas = await within(dialogo).findByRole('group', { name: 'Ideas (1)' })
    await user.click(within(ideas).getByRole('radio', { name: 'Borrar' }))
    await user.click(within(grupo(dialogo, 'Subproyectos (2)')).getByRole('radio', { name: 'Mover' }))
    await waitFor(() => expect(within(dialogo).queryByRole('group', { name: /Ideas/ })).not.toBeInTheDocument())

    await user.click(within(grupo(dialogo, 'Subproyectos (2)')).getByRole('radio', { name: 'Borrar' }))
    const otraVez = await within(dialogo).findByRole('group', { name: 'Ideas (1)' })
    expect(within(otraVez).getByRole('radio', { name: 'Borrar' })).toBeChecked()
  })

  it('un 409 del DELETE muestra el mensaje, deja el diálogo abierto y vuelve a pedir la vista previa', async () => {
    vi.mocked(borrarProyecto).mockRejectedValue(new ApiError(409, 'El proyecto 1 tiene tareas: decide qué hacer con ellas'))
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    const llamadas = vi.mocked(getImpactoBorradoProyecto).mock.calls.length

    await user.click(botonBorrar(dialogo))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El proyecto 1 tiene tareas: decide qué hacer con ellas')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(getImpactoBorradoProyecto).mock.calls.length).toBeGreaterThan(llamadas))
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
  })

  it('si la vista previa falla ofrece Reintentar, no deja confirmar y no manda un DELETE a ciegas', async () => {
    vi.mocked(getImpactoBorradoProyecto).mockRejectedValueOnce(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudo calcular qué se borra')
    expect(botonBorrar(dialogo)).toBeDisabled()
    expect(within(dialogo).queryByRole('group')).not.toBeInTheDocument()
    await user.click(botonBorrar(dialogo))
    expect(borrarProyecto).not.toHaveBeenCalled()

    await user.click(within(dialogo).getByRole('button', { name: 'Reintentar' }))
    await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    expect(within(dialogo).queryByText('No se pudo calcular qué se borra')).not.toBeInTheDocument()
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
  })

  it('si falla al recalcular tras un cambio también queda sin confirmar, aunque hubiera datos previos', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    const tareas = await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    vi.mocked(getImpactoBorradoProyecto).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor.'))
    await user.click(within(tareas).getByRole('radio', { name: 'Borrar' }))

    expect(await within(dialogo).findByText('No se pudo calcular qué se borra')).toBeInTheDocument()
    expect(botonBorrar(dialogo)).toBeDisabled()
    expect(within(dialogo).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(borrarProyecto).not.toHaveBeenCalled()
  })

  it('tras borrar con éxito refresca también tareas, agenda y recordatorios', async () => {
    const { user, dialogo } = await abrir(CONFIG_PROYECTO, casa)
    await within(dialogo).findByRole('group', { name: 'Tareas (2)' })
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarProyecto).toHaveBeenCalled())
    await waitFor(() => {
      const claves = invalidar.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))
      for (const clave of ['["proyectos"]', '["objetivos"]', '["tareas"]', '["agenda"]', '["recordatorios"]']) expect(claves).toContain(clave)
    })
  })
})

describe('BorrarItemDialog: objetivo', () => {
  const salud = objetivo({ id: 3, nombre: 'Salud' })

  beforeEach(() => {
    vi.mocked(getImpactoBorradoObjetivo).mockImplementation(async (_, e) => impactoObjetivo(e ?? {}))
    vi.mocked(borrarObjetivo).mockResolvedValue(undefined)
  })

  it('sin dependencias queda el diálogo simple y el DELETE va sin parámetros', async () => {
    vi.mocked(getImpactoBorradoObjetivo).mockResolvedValue(SIN_NADA_OBJETIVO)
    const { user, dialogo } = await abrir(CONFIG_OBJETIVO, salud)
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    expect(within(dialogo).queryByRole('group')).not.toBeInTheDocument()
    await user.click(botonBorrar(dialogo))
    await waitFor(() => expect(borrarObjetivo).toHaveBeenCalledTimes(1))
    expect(vi.mocked(borrarObjetivo).mock.calls[0]).toEqual([3])
  })

  it('con dependencias muestra las filas con elementos con su ayuda de Mover y manda conservar explícito', async () => {
    const { user, dialogo } = await abrir(CONFIG_OBJETIVO, salud)
    const subobjetivos = await within(dialogo).findByRole('group', { name: 'Subobjetivos (1)' })
    const proyectos = grupo(dialogo, 'Proyectos (3)')
    const tareas = grupo(dialogo, 'Tareas (2)')
    expect(within(dialogo).queryByRole('group', { name: /Ideas/ })).not.toBeInTheDocument()
    expect(within(subobjetivos).getByText('Pasan al nivel superior')).toBeInTheDocument()
    expect(within(proyectos).getByText('Quedan sin objetivo')).toBeInTheDocument()
    expect(within(tareas).getByText('Quedan sueltas')).toBeInTheDocument()
    expect(within(dialogo).getByRole('status')).toHaveTextContent('Solo se borrará «Salud».')

    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    await user.click(botonBorrar(dialogo))
    await waitFor(() =>
      expect(borrarObjetivo).toHaveBeenCalledWith(3, { subobjetivos: 'conservar', proyectos: 'conservar', tareas: 'conservar' }),
    )
  })

  it('al borrar los proyectos avisa cuáles se salvan y el resumen cuenta solo lo que se borra', async () => {
    const { user, dialogo } = await abrir(CONFIG_OBJETIVO, salud)
    const proyectos = await within(dialogo).findByRole('group', { name: 'Proyectos (3)' })
    await user.click(within(proyectos).getByRole('radio', { name: 'Borrar' }))

    await waitFor(() => expect(within(dialogo).getByRole('status')).toHaveTextContent('Se borrarán «Salud» y 2 proyectos.'))
    expect(within(dialogo).getByRole('status')).toHaveTextContent('1 proyecto se salva por estar ligado a otro objetivo.')
    expect(within(proyectos).getByText('Se borran 2 proyectos')).toBeInTheDocument()

    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    await user.click(botonBorrar(dialogo))
    await waitFor(() =>
      expect(borrarObjetivo).toHaveBeenCalledWith(3, { subobjetivos: 'conservar', proyectos: 'borrar', tareas: 'conservar' }),
    )
    await waitFor(() => expect(screen.getByTestId('aviso')).toHaveTextContent('«Salud» borrado; también 2 proyectos'))
  })

  it('un 409 del DELETE muestra el mensaje y vuelve a pedir la vista previa', async () => {
    vi.mocked(borrarObjetivo).mockRejectedValue(new ApiError(409, 'El objetivo 3 tiene proyectos: decide qué hacer con ellos'))
    const { user, dialogo } = await abrir(CONFIG_OBJETIVO, salud)
    await within(dialogo).findByRole('group', { name: 'Proyectos (3)' })
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    const llamadas = vi.mocked(getImpactoBorradoObjetivo).mock.calls.length
    await user.click(botonBorrar(dialogo))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('El objetivo 3 tiene proyectos: decide qué hacer con ellos')
    await waitFor(() => expect(vi.mocked(getImpactoBorradoObjetivo).mock.calls.length).toBeGreaterThan(llamadas))
  })

  it('si la vista previa falla ofrece Reintentar y no deja confirmar', async () => {
    vi.mocked(getImpactoBorradoObjetivo).mockRejectedValueOnce(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    const { user, dialogo } = await abrir(CONFIG_OBJETIVO, salud)
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudo calcular qué se borra')
    expect(botonBorrar(dialogo)).toBeDisabled()
    await user.click(within(dialogo).getByRole('button', { name: 'Reintentar' }))
    await within(dialogo).findByRole('group', { name: 'Proyectos (3)' })
    await waitFor(() => expect(botonBorrar(dialogo)).toBeEnabled())
    expect(borrarObjetivo).not.toHaveBeenCalled()
  })
})
