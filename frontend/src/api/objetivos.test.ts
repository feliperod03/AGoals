import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { actualizarObjetivo, asignarTarea, borrarObjetivo, crearObjetivo, getImpactoBorradoObjetivo, getObjetivos, quitarTarea } from './objetivos'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const REQUEST = { nombre: 'Aprender inglés', descripcion: 'B2', estado: 'PENDIENTE' as const, prioridad: null, padreId: 1 }

describe('api/objetivos', () => {
  it('getObjetivos pide la lista completa, sin filtros', async () => {
    await getObjetivos()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos')
    expect(init.method).toBe('GET')
  })

  it('crearObjetivo hace POST con todo el cuerpo (sin objetivoId)', async () => {
    await crearObjetivo(REQUEST)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('actualizarObjetivo hace PUT con todos los campos', async () => {
    await actualizarObjetivo(3, { ...REQUEST, padreId: null })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos/3')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ ...REQUEST, padreId: null })
  })

  it('borrarObjetivo hace DELETE y un 409 llega con el mensaje del servidor', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(borrarObjetivo(3)).resolves.toBeUndefined()
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('DELETE')

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mensaje: 'El objetivo 3 tiene proyectos: cámbiales el objetivo o bórralos primero', errores: [] }), { status: 409 }),
    )
    const error = await borrarObjetivo(3).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('El objetivo 3 tiene proyectos: cámbiales el objetivo o bórralos primero')
  })

  it('getImpactoBorradoObjetivo pide la vista previa, sin parámetros o con las elecciones', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }))
    await getImpactoBorradoObjetivo(3)
    await getImpactoBorradoObjetivo(3, { subobjetivos: 'conservar', proyectos: 'borrar', tareas: 'conservar', ideas: 'borrar' })
    const [sin, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(sin).toBe('/api/objetivos/3/impacto-borrado')
    expect(init.method).toBe('GET')
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(
      '/api/objetivos/3/impacto-borrado?subobjetivos=conservar&proyectos=borrar&tareas=conservar&ideas=borrar',
    )
  })

  it('borrarObjetivo con elecciones las manda como parámetros del DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await borrarObjetivo(3, { subobjetivos: 'conservar', proyectos: 'borrar', tareas: 'conservar', ideas: 'conservar' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos/3?subobjetivos=conservar&proyectos=borrar&tareas=conservar&ideas=conservar')
    expect(init.method).toBe('DELETE')
  })

  it('borrarObjetivo sin elecciones o con elecciones vacías no agrega nada a la URL', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    await borrarObjetivo(3)
    await borrarObjetivo(3, {})
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/objetivos/3')
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('/api/objetivos/3')
  })

  it('asignarTarea hace PUT sin cuerpo ni Content-Type y devuelve la tarea', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 12, objetivoId: 7 }), { status: 200 }))
    await expect(asignarTarea(7, 12)).resolves.toMatchObject({ id: 12, objetivoId: 7 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos/7/tareas/12')
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(init.headers).toBeUndefined()
  })

  it('quitarTarea hace DELETE y tolera el 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(quitarTarea(7, 12)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/objetivos/7/tareas/12')
    expect(init.method).toBe('DELETE')
  })

  it('quitarTarea: el 400 de "no pertenece" llega con el mensaje del servidor', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'La tarea 12 no pertenece al objetivo 7', errores: [] }), { status: 400 }))
    const error = await quitarTarea(7, 12).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).message).toBe('La tarea 12 no pertenece al objetivo 7')
  })

  it('asignarTarea: un 404 llega como ApiError', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'No existe el objetivo 7', errores: [] }), { status: 404 }))
    const error = await asignarTarea(7, 12).catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(404)
  })
})
