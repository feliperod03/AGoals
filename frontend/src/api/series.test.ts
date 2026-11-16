import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { borrarSerieDesde, crearSerie } from './series'
import type { SerieEventoRequest } from '@/types/serie'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const REQUEST: SerieEventoRequest = {
  titulo: 'Gimnasio',
  descripcion: '',
  prioridad: null,
  horaInicio: '07:00',
  horaFin: '08:00',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  ahora: '2090-01-02T08:00:00-03:00',
  frecuencia: 'SEMANAL',
  diasSemana: ['LUNES', 'MIERCOLES'],
  intervaloSemanas: 1,
  repeticiones: 10,
  recordatorio: { minutosAntes: 30 },
}

const llamada = () => fetchMock.mock.calls[0] as [string, RequestInit]

describe('api/series', () => {
  it('crearSerie hace POST a /api/series-eventos con el cuerpo tal cual', async () => {
    await crearSerie(REQUEST)
    const [url, init] = llamada()
    expect(url).toBe('/api/series-eventos')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('borrarSerieDesde hace DELETE a /api/eventos/{id}/serie sin cuerpo y tolera el 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(borrarSerieDesde(7)).resolves.toBeUndefined()
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos/7/serie')
    expect(init.method).toBe('DELETE')
    expect(init.body).toBeUndefined()
  })

  it.each([
    [400, 'La serie generaría más de 260 eventos; el máximo es 260: elige un final más cercano'],
    [409, 'El evento 7 no pertenece a una serie: usa la edición normal'],
  ])('un %i llega como ApiError con el mensaje del servidor', async (status, mensaje) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje, errores: [] }), { status }))
    const error = await crearSerie(REQUEST).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
    expect((error as ApiError).message).toBe(mensaje)
  })
})
