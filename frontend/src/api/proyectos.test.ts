import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { actualizarProyecto, asignarTarea, borrarProyecto, crearProyecto, getImpactoBorradoProyecto, getProyectos, quitarTarea } from './proyectos'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const REQUEST = {
  nombre: 'Mudanza',
  descripcion: null,
  estado: 'EN_PROGRESO' as const,
  prioridad: 'ALTA' as const,
  padreId: 2,
  objetivoId: 5,
}

describe('api/proyectos', () => {
  it('getProyectos pide la lista completa, sin filtros', async () => {
    await getProyectos()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos')
    expect(init.method).toBe('GET')
  })

  it('crearProyecto hace POST con todo el cuerpo', async () => {
    await crearProyecto(REQUEST)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('actualizarProyecto hace PUT con todos los campos (también los null)', async () => {
    await actualizarProyecto(7, { ...REQUEST, padreId: null, objetivoId: null, prioridad: null })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos/7')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ ...REQUEST, padreId: null, objetivoId: null, prioridad: null })
  })

  it('borrarProyecto hace DELETE y tolera el 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(borrarProyecto(7)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos/7')
    expect(init.method).toBe('DELETE')
  })

  it('un 409 llega con el mensaje del servidor tal cual', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mensaje: 'El proyecto 7 tiene subproyectos: muévelos o bórralos primero', errores: [] }), { status: 409 }),
    )
    const error = await borrarProyecto(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).message).toBe('El proyecto 7 tiene subproyectos: muévelos o bórralos primero')
  })

  it('getImpactoBorradoProyecto pide la vista previa, sin parámetros o con las elecciones', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await getImpactoBorradoProyecto(7)
    await getImpactoBorradoProyecto(7, { subproyectos: 'borrar', tareas: 'conservar', ideas: 'conservar' })
    const [sin, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(sin).toBe('/api/proyectos/7/impacto-borrado')
    expect(init.method).toBe('GET')
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/proyectos/7/impacto-borrado?subproyectos=borrar&tareas=conservar&ideas=conservar')
  })

  it('borrarProyecto con elecciones las manda como parámetros del DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await borrarProyecto(7, { subproyectos: 'conservar', tareas: 'borrar', ideas: 'conservar' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos/7?subproyectos=conservar&tareas=borrar&ideas=conservar')
    expect(init.method).toBe('DELETE')
  })

  it('borrarProyecto con elecciones vacías no agrega nada a la URL', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await borrarProyecto(7, {})
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/proyectos/7')
  })

  it('asignarTarea hace PUT sin cuerpo ni Content-Type y devuelve la tarea', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 12, proyectoId: 7 }), { status: 200 }))
    await expect(asignarTarea(7, 12)).resolves.toMatchObject({ id: 12, proyectoId: 7 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos/7/tareas/12')
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(init.headers).toBeUndefined()
  })

  it('quitarTarea hace DELETE y tolera el 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(quitarTarea(7, 12)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/proyectos/7/tareas/12')
    expect(init.method).toBe('DELETE')
  })

  it('quitarTarea: el 400 de "no pertenece" llega con el mensaje del servidor', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'La tarea 12 no pertenece al proyecto 7', errores: [] }), { status: 400 }))
    const error = await quitarTarea(7, 12).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).message).toBe('La tarea 12 no pertenece al proyecto 7')
  })

  it('asignarTarea: un 404 llega como ApiError', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'No existe el proyecto 7', errores: [] }), { status: 404 }))
    const error = await asignarTarea(7, 12).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(404)
  })
})
