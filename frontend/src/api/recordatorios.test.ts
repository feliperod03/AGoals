import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRecordatoriosVencidos, marcarRecordatorioEnviado } from './recordatorios'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const llamada = () => fetchMock.mock.calls[0] as [string, RequestInit]

describe('api/recordatorios', () => {
  it('getRecordatoriosVencidos manda ahora con el desfase codificado (%2B)', async () => {
    await getRecordatoriosVencidos('2026-11-10T12:00:00+01:00')
    const [url, init] = llamada()
    expect(url).toBe('/api/recordatorios/vencidos?ahora=2026-11-10T12%3A00%3A00%2B01%3A00')
    expect(url).toContain('%2B')
    expect(init.method).toBe('GET')
  })

  it('marcarRecordatorioEnviado hace PATCH a /{id}/marcar-enviado sin cuerpo', async () => {
    await marcarRecordatorioEnviado(7)
    const [url, init] = llamada()
    expect(url).toBe('/api/recordatorios/7/marcar-enviado')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBeUndefined()
  })
})
