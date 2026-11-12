import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { actualizarEvento, borrarEvento, crearEvento, getEvento, getEventos } from './eventos'

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
  titulo: 'Dentista',
  descripcion: '',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: null,
}

const llamada = () => fetchMock.mock.calls[0] as [string, RequestInit]

describe('api/eventos: lectura', () => {
  it('getEventos manda el rango con el + del desfase codificado', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    await getEventos({ desde: '2026-12-15T00:00:00+01:00', hasta: '2026-12-16T00:00:00+01:00' })
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos?desde=2026-12-15T00%3A00%3A00%2B01%3A00&hasta=2026-12-16T00%3A00%3A00%2B01%3A00')
    expect(init.method).toBe('GET')
  })

  it('getEvento pide /api/eventos/{id}', async () => {
    await getEvento(4)
    expect(llamada()[0]).toBe('/api/eventos/4')
  })
})

describe('api/eventos: escritura', () => {
  it('crearEvento hace POST con los cinco campos (también los null)', async () => {
    await crearEvento(REQUEST)
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('actualizarEvento hace PUT a /api/eventos/{id} con el cuerpo completo', async () => {
    const cuerpo = { ...REQUEST, descripcion: 'Llevar estudios', prioridad: 'ALTA' as const }
    await actualizarEvento(7, cuerpo)
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos/7')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual(cuerpo)
  })

  it('borrarEvento hace DELETE sin parámetros y tolera el 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(borrarEvento(7)).resolves.toBeUndefined()
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos/7')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })

  it.each([
    [400, "'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'"],
    [404, 'No existe el evento con id 7'],
  ])('un %i llega como ApiError con el mensaje del servidor', async (status, mensaje) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje, errores: [] }), { status }))
    const error = await actualizarEvento(7, REQUEST).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
    expect((error as ApiError).message).toBe(mensaje)
  })

  it('un 400 de validación suma los errores de campo al mensaje', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'Datos inválidos', errores: ['titulo: no debe estar vacío'] }), { status: 400 }))
    const error = (await crearEvento(REQUEST).catch((e: unknown) => e)) as ApiError
    expect(error.message).toBe('Datos inválidos: titulo: no debe estar vacío')
  })

  it('sin conexión el error tiene status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = (await borrarEvento(7).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(0)
  })
})
