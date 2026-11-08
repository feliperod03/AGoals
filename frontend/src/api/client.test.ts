import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, del, get, post } from './client'

function responder(status: number, cuerpo?: string) {
  const fetchFalso = vi.fn().mockResolvedValue(new Response(cuerpo ?? null, { status }))
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

async function errorDe(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError)
    return e as ApiError
  }
  throw new Error('Se esperaba un ApiError')
}

afterEach(() => vi.unstubAllGlobals())

describe('client', () => {
  it('devuelve el JSON de una respuesta correcta', async () => {
    responder(200, JSON.stringify({ fecha: '2026-11-10' }))
    await expect(get('/api/tareas/agenda', { fecha: '2026-11-10' })).resolves.toEqual({ fecha: '2026-11-10' })
  })

  it('codifica los query params y omite los nulos', async () => {
    const fetchFalso = responder(200, '[]')
    await get('/api/eventos', { desde: '2026-11-10T00:00:00+02:00', hasta: null, otro: undefined })
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('/api/eventos?desde=2026-11-10T00%3A00%3A00%2B02%3A00')
  })

  it('manda el cuerpo como JSON', async () => {
    const fetchFalso = responder(201, '{"id":1}')
    await post('/api/tareas', { titulo: 'x' })
    const init = fetchFalso.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"titulo":"x"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('un 204 no tiene cuerpo y resuelve sin error', async () => {
    responder(204)
    await expect(del('/api/tareas/1')).resolves.toBeUndefined()
  })

  it('400 usa el mensaje del backend', async () => {
    responder(400, JSON.stringify({ mensaje: 'La fecha es obligatoria', errores: [] }))
    const e = await errorDe(get('/api/x'))
    expect(e.status).toBe(400)
    expect(e.message).toBe('La fecha es obligatoria')
  })

  it('400 de validación añade el detalle de cada campo', async () => {
    responder(400, JSON.stringify({ mensaje: 'Datos inválidos', errores: ['titulo: no debe estar vacío'] }))
    const e = await errorDe(post('/api/tareas', {}))
    expect(e.message).toBe('Datos inválidos: titulo: no debe estar vacío')
    expect(e.errores).toEqual(['titulo: no debe estar vacío'])
  })

  it('404 y 409 usan el mensaje del backend', async () => {
    responder(404, JSON.stringify({ mensaje: 'La tarea no existe: 9', errores: [] }))
    expect((await errorDe(get('/api/tareas/9'))).message).toBe('La tarea no existe: 9')

    responder(409, JSON.stringify({ mensaje: 'La tarea tiene subtareas', errores: [] }))
    const e = await errorDe(del('/api/tareas/1'))
    expect(e.status).toBe(409)
    expect(e.message).toBe('La tarea tiene subtareas')
  })

  it('un 400 sin cuerpo (enum inválido) da un mensaje genérico', async () => {
    responder(400)
    const e = await errorDe(get('/api/tareas'))
    expect(e.status).toBe(400)
    expect(e.message).toBe('La solicitud no es válida.')
  })

  it('un error con cuerpo que no es JSON da un mensaje genérico', async () => {
    responder(404, '<html>Not Found</html>')
    expect((await errorDe(get('/api/x'))).message).toBe('No se encontró lo que buscabas.')
  })

  it('un JSON de error sin el campo mensaje da un mensaje genérico', async () => {
    responder(409, '{"otro":1}')
    expect((await errorDe(get('/api/x'))).message).toBe('La acción choca con el estado actual de los datos.')
  })

  it('un 5xx da un mensaje genérico con el status', async () => {
    responder(503, '<html>Bad gateway</html>')
    const e = await errorDe(get('/api/x'))
    expect(e.status).toBe(503)
    expect(e.message).toBe('Error del servidor (503). Inténtalo de nuevo más tarde.')
  })

  it('un 500 con cuerpo JSON usa igualmente el mensaje del backend', async () => {
    responder(500, JSON.stringify({ mensaje: 'Algo falló', errores: [] }))
    expect((await errorDe(get('/api/x'))).message).toBe('Algo falló')
  })

  it('sin conexión da status 0 y un mensaje legible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const e = await errorDe(get('/api/x'))
    expect(e.status).toBe(0)
    expect(e.message).toContain('No se pudo conectar')
  })
})
