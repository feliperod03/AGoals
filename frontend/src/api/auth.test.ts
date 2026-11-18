import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { login, logout, pedirCsrf, yo } from './auth'
import { ApiError } from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response('{"id":1,"nombreUsuario":"felipe","email":"f@x.com"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const llamada = (n = 0) => fetchMock.mock.calls[n] as [string, RequestInit]

describe('api/auth', () => {
  it('login hace POST con email, clave y recordarme, y devuelve el usuario', async () => {
    await expect(login({ email: 'f@x.com', clave: 'secreta', recordarme: true })).resolves.toEqual({
      id: 1,
      nombreUsuario: 'felipe',
      email: 'f@x.com',
    })
    const [url, init] = llamada()
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'f@x.com', clave: 'secreta', recordarme: true })
    expect(init.headers).toMatchObject({ 'X-XSRF-TOKEN': expect.any(String) })
  })

  it('logout hace POST sin cuerpo (204) con el token CSRF', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(logout()).resolves.toBeUndefined()
    const [url, init] = llamada()
    expect(url).toBe('/api/auth/logout')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(init.headers).toMatchObject({ 'X-XSRF-TOKEN': expect.any(String) })
  })

  it('yo hace GET sin cabecera CSRF', async () => {
    await yo()
    const [url, init] = llamada()
    expect(url).toBe('/api/auth/yo')
    expect(init.method).toBe('GET')
    expect(init.headers).toBeUndefined()
  })

  it('pedirCsrf hace GET /api/auth/csrf', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await pedirCsrf()
    const [url, init] = llamada()
    expect(url).toBe('/api/auth/csrf')
    expect(init.method).toBe('GET')
  })

  it('el 401 del login llega como ApiError con el mensaje del servidor', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ mensaje: 'Email o contraseña incorrectos', errores: [] }), { status: 401 }))
    await expect(login({ email: 'a@b.c', clave: 'x', recordarme: false })).rejects.toMatchObject({
      status: 401,
      message: 'Email o contraseña incorrectos',
    })
    await expect(login({ email: 'a@b.c', clave: 'x', recordarme: false })).rejects.toBeInstanceOf(ApiError)
  })

  it('el 429 llega con el mensaje del servidor', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ mensaje: 'Demasiados intentos fallidos. Espera 15 minutos.', errores: [] }), { status: 429 }),
    )
    await expect(login({ email: 'a@b.c', clave: 'x', recordarme: false })).rejects.toMatchObject({
      status: 429,
      message: 'Demasiados intentos fallidos. Espera 15 minutos.',
    })
  })
})
