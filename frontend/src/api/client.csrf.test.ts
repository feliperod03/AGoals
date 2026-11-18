import { afterEach, describe, expect, it, vi } from 'vitest'

import { fijarCookieCsrf, TOKEN_CSRF_PRUEBA } from '@/test/csrf'
import { alPerderSesion, ApiError, del, get, patch, pedirCsrf, post, put } from './client'

afterEach(() => vi.unstubAllGlobals())

const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status })
const llamadaN = (f: ReturnType<typeof vi.fn>, n: number) => f.mock.calls[n] as [string, RequestInit]
const cabecera = (init: RequestInit, nombre: string) => (init.headers as Record<string, string> | undefined)?.[nombre]
const MENSAJE_CSRF = 'Falta el token CSRF o no es válido'

function responderSiempre(status: number, cuerpo?: unknown) {
  const f = vi.fn().mockImplementation(async () => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status }))
  vi.stubGlobal('fetch', f)
  return f
}

/** Un fetch donde /api/auth/csrf deja la cookie y todo lo demás responde 200 `{}`. */
function fetchConCsrf(tokenNuevo: string) {
  const f = vi.fn().mockImplementation(async (url: string) => {
    if (url === '/api/auth/csrf') {
      fijarCookieCsrf(tokenNuevo)
      return new Response(null, { status: 204 })
    }
    return new Response('{}', { status: 200 })
  })
  vi.stubGlobal('fetch', f)
  return f
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

describe('CSRF', () => {
  it('las escrituras llevan X-XSRF-TOKEN y el GET no', async () => {
    const f = responderSiempre(200, {})
    await get('/api/x')
    expect(cabecera(llamadaN(f, 0)[1], 'X-XSRF-TOKEN')).toBeUndefined()

    await post('/api/x', {})
    await put('/api/x', {})
    await patch('/api/x')
    await del('/api/x')
    for (const i of [1, 2, 3, 4]) {
      expect(cabecera(llamadaN(f, i)[1], 'X-XSRF-TOKEN')).toBe(TOKEN_CSRF_PRUEBA)
    }
    expect(llamadaN(f, 1)[1].method).toBe('POST')
    expect(llamadaN(f, 4)[1].method).toBe('DELETE')
  })

  it('lee la cookie en cada petición (nunca la guarda)', async () => {
    const f = responderSiempre(200, {})
    await post('/api/x', {})
    fijarCookieCsrf('otro-token')
    await post('/api/x', {})
    expect(cabecera(llamadaN(f, 0)[1], 'X-XSRF-TOKEN')).toBe(TOKEN_CSRF_PRUEBA)
    expect(cabecera(llamadaN(f, 1)[1], 'X-XSRF-TOKEN')).toBe('otro-token')
  })

  it('sin cookie pide antes GET /api/auth/csrf y después escribe con el token nuevo', async () => {
    fijarCookieCsrf(null)
    const f = fetchConCsrf('recien-llegado')
    await post('/api/x', {})
    expect(f).toHaveBeenCalledTimes(2)
    expect(llamadaN(f, 0)[0]).toBe('/api/auth/csrf')
    expect(llamadaN(f, 0)[1].method).toBe('GET')
    expect(llamadaN(f, 1)[0]).toBe('/api/x')
    expect(cabecera(llamadaN(f, 1)[1], 'X-XSRF-TOKEN')).toBe('recien-llegado')
  })

  it('un GET sin cookie no pide /csrf', async () => {
    fijarCookieCsrf(null)
    const f = responderSiempre(200, {})
    await get('/api/x')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('dos escrituras en paralelo sin cookie hacen un solo /csrf', async () => {
    fijarCookieCsrf(null)
    const f = fetchConCsrf('t')
    await Promise.all([post('/api/a', {}), post('/api/b', {})])
    expect(f.mock.calls.filter(([url]) => url === '/api/auth/csrf')).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('un fallo de /csrf no deja bloqueadas las escrituras siguientes (la promesa compartida se libera)', async () => {
    fijarCookieCsrf(null)
    const f = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', f)
    const e = await errorDe(post('/api/x', {}))
    expect(e.status).toBe(0)
    expect(f).toHaveBeenCalledTimes(1) // la escritura no llegó a enviarse

    f.mockImplementation(async (url: string) => {
      if (url === '/api/auth/csrf') {
        fijarCookieCsrf('ya-funciona')
        return new Response(null, { status: 204 })
      }
      return new Response('{}', { status: 200 })
    })
    await expect(post('/api/x', {})).resolves.toEqual({})
    expect(f.mock.calls.filter(([url]) => url === '/api/auth/csrf')).toHaveLength(2)
  })

  it('pedirCsrf también se libera tras un error HTTP', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json(500, { mensaje: 'Falló', errores: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', f)
    await expect(pedirCsrf()).rejects.toMatchObject({ status: 500, message: 'Falló' })
    await expect(pedirCsrf()).resolves.toBeUndefined()
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('un 403 en una escritura renueva el token y reintenta UNA vez', async () => {
    const respuestas = [json(403, { mensaje: MENSAJE_CSRF, errores: [] }), new Response(null, { status: 204 }), json(200, { ok: 1 })]
    const f = vi.fn().mockImplementation(async () => respuestas.shift())
    vi.stubGlobal('fetch', f)
    await expect(post('/api/x', { a: 1 })).resolves.toEqual({ ok: 1 })
    expect(f).toHaveBeenCalledTimes(3)
    expect(llamadaN(f, 1)[0]).toBe('/api/auth/csrf')
    expect(llamadaN(f, 2)[0]).toBe('/api/x')
    expect(llamadaN(f, 2)[1].body).toBe('{"a":1}')
  })

  it('un segundo 403 seguido da el error del servidor, sin un tercer intento', async () => {
    const f = vi.fn().mockImplementation(async (url: string) =>
      url === '/api/auth/csrf' ? new Response(null, { status: 204 }) : json(403, { mensaje: MENSAJE_CSRF, errores: [] }),
    )
    vi.stubGlobal('fetch', f)
    const e = await errorDe(post('/api/x', {}))
    expect(e.status).toBe(403)
    expect(e.message).toBe(MENSAJE_CSRF)
    expect(f).toHaveBeenCalledTimes(3) // escritura, /csrf, escritura
  })

  it('un 403 en un GET no se reintenta', async () => {
    const f = responderSiempre(403, { mensaje: 'Prohibido', errores: [] })
    await errorDe(get('/api/x'))
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('sesión perdida', () => {
  const SIN_SESION = { mensaje: 'Inicia sesión para continuar', errores: [] }

  it('un 401 en una ruta de datos avisa a los oyentes y sigue lanzando el ApiError', async () => {
    const oyente = vi.fn()
    const baja = alPerderSesion(oyente)
    responderSiempre(401, SIN_SESION)
    const e = await errorDe(get('/api/tareas'))
    expect(e.status).toBe(401)
    expect(e.message).toBe('Inicia sesión para continuar')
    expect(oyente).toHaveBeenCalledTimes(1)
    baja()
  })

  it('avisa también en una escritura', async () => {
    const oyente = vi.fn()
    const baja = alPerderSesion(oyente)
    responderSiempre(401, SIN_SESION)
    await errorDe(del('/api/tareas/1'))
    expect(oyente).toHaveBeenCalledTimes(1)
    baja()
  })

  it('los 401 de /api/auth/* (login, yo) no avisan', async () => {
    const oyente = vi.fn()
    const baja = alPerderSesion(oyente)
    responderSiempre(401, { mensaje: 'Email o contraseña incorrectos', errores: [] })
    expect((await errorDe(post('/api/auth/login', {}))).status).toBe(401)
    await errorDe(get('/api/auth/yo'))
    expect(oyente).not.toHaveBeenCalled()
    baja()
  })

  it('tras darse de baja, el oyente ya no se llama', async () => {
    const oyente = vi.fn()
    alPerderSesion(oyente)()
    responderSiempre(401, SIN_SESION)
    await errorDe(get('/api/x'))
    expect(oyente).not.toHaveBeenCalled()
  })
})
