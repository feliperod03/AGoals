import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import { borrarSerieDesde, crearSerie, editarSerieDesde } from './series'
import type { SerieEventoEdicionRequest, SerieEventoRequest } from '@/types/serie'

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

  it('editarSerieDesde hace PUT a /api/eventos/{id}/serie con el cuerpo tal cual (recordatorio null incluido)', async () => {
    const respuesta = { eventos: [], recordatoriosOmitidos: 2 }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(respuesta), { status: 200 }))
    const edicion: SerieEventoEdicionRequest = {
      titulo: 'Gimnasio',
      descripcion: '',
      prioridad: null,
      horaInicio: '07:30',
      horaFin: '08:30',
      ahora: '2090-01-02T08:00:00-03:00',
      recordatorio: null,
    }
    await expect(editarSerieDesde(7, edicion)).resolves.toEqual(respuesta)
    const [url, init] = llamada()
    expect(url).toBe('/api/eventos/7/serie')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual(edicion)
  })

  it('editarSerieDesde manda los minutos del recordatorio', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ eventos: [], recordatoriosOmitidos: 0 }), { status: 200 }))
    await editarSerieDesde(7, {
      titulo: 'G',
      descripcion: '',
      prioridad: 'ALTA',
      horaInicio: '22:00',
      horaFin: '01:00',
      ahora: '2090-01-02T08:00:00-03:00',
      recordatorio: { minutosAntes: 30 },
    })
    expect(JSON.parse(llamada()[1].body as string)).toMatchObject({ recordatorio: { minutosAntes: 30 }, prioridad: 'ALTA' })
  })

  it.each([
    [400, 'Las series no admiten eventos de todo el día: la hora de fin debe ser distinta de la de inicio'],
    [404, 'Evento 7 no encontrado'],
    [409, 'El evento 7 no pertenece a una serie: usa la edición normal'],
  ])('editarSerieDesde: un %i llega como ApiError con el mensaje del servidor', async (status, mensaje) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje, errores: [] }), { status }))
    const error = await editarSerieDesde(7, {
      titulo: 'G',
      descripcion: '',
      prioridad: null,
      horaInicio: '07:00',
      horaFin: '08:00',
      ahora: '2090-01-02T08:00:00-03:00',
      recordatorio: null,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(status)
    expect((error as ApiError).message).toBe(mensaje)
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
