import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { actualizarObjetivo, borrarObjetivo, crearObjetivo, getImpactoBorradoObjetivo, getObjetivos } from './objetivos'

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

})
