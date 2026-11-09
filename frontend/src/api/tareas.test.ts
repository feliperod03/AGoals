import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { agendarTarea, getRecomendacion, getTareas, posponerTarea } from './tareas'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('getRecomendacion', () => {
  it('manda solo los parámetros con valor', async () => {
    await getRecomendacion({ fecha: '2026-11-10', orden: 'antiguedad', sentido: 'asc', proyectoId: 4 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/tareas/recomendacion?fecha=2026-11-10&orden=antiguedad&sentido=asc&proyectoId=4')
    expect(init.method).toBe('GET')
  })

  it('con solo la fecha no manda nada más', async () => {
    await getRecomendacion({ fecha: '2026-11-10', proyectoId: undefined })
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/tareas/recomendacion?fecha=2026-11-10')
  })
})

describe('agendarTarea', () => {
  it('hace PATCH a /agendar con el cuerpo en JSON', async () => {
    await agendarTarea(7, { fecha: '2026-11-10', hoy: '2026-11-10', incluirSubtareas: false })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/tareas/7/agendar')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ fecha: '2026-11-10', hoy: '2026-11-10', incluirSubtareas: false })
  })
})

describe('posponerTarea', () => {
  it('hace PATCH a /posponer con la fecha explícita en el cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await posponerTarea(7, '2026-11-11')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/tareas/7/posponer')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ fecha: '2026-11-11' })
  })
})

describe('getTareas', () => {
  it('hace GET a /api/tareas sin parámetros', async () => {
    await getTareas()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/tareas')
    expect(init.method).toBe('GET')
  })
})
