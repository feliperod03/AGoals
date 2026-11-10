import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { actualizarIdea, borrarIdea, concluirIdea, crearIdea, getIdeas, reabrirIdea } from './ideas'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const REQUEST = { titulo: 'Cantar', descripcion: 'En el coro', proyectoId: 3, objetivoId: null, conclusion: null }

const llamada = () => fetchMock.mock.calls[0] as [string, RequestInit]

describe('api/ideas', () => {
  it('getIdeas pide la lista completa, sin filtros', async () => {
    await getIdeas()
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas')
    expect(init.method).toBe('GET')
  })

  it('crearIdea hace POST con todo el cuerpo (también los null)', async () => {
    await crearIdea(REQUEST)
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('actualizarIdea hace PUT con los cinco campos', async () => {
    await actualizarIdea(7, { ...REQUEST, proyectoId: null, conclusion: 'Salió bien' })
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas/7')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ ...REQUEST, proyectoId: null, conclusion: 'Salió bien' })
  })

  it('concluirIdea con texto hace PATCH con { conclusion }', async () => {
    await concluirIdea(7, '  Sí, vale la pena  ')
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas/7/concluir')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ conclusion: 'Sí, vale la pena' })
  })

  it.each([undefined, '', '   '])('concluirIdea sin texto (%j) no manda cuerpo ni Content-Type', async (texto) => {
    await concluirIdea(7, texto)
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas/7/concluir')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBeUndefined()
    expect(init.headers).toBeUndefined()
  })

  it('reabrirIdea hace PATCH sin cuerpo', async () => {
    await reabrirIdea(7)
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas/7/reabrir')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBeUndefined()
  })

  it('borrarIdea hace DELETE sin parámetros y tolera el 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(borrarIdea(7)).resolves.toBeUndefined()
    const [url, init] = llamada()
    expect(url).toBe('/api/ideas/7')
    expect(init.method).toBe('DELETE')
  })

  it.each([
    [400, 'El proyecto no existe: 9'],
    [404, 'No existe la idea 7'],
    [409, 'La idea 7 ya está concluida'],
  ])('un %i llega como ApiError con el mensaje del servidor', async (status, mensaje) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje, errores: [] }), { status }))
    const error = await concluirIdea(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
    expect((error as ApiError).message).toBe(mensaje)
  })
})
