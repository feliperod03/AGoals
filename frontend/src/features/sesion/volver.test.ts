import { describe, expect, it } from 'vitest'

import { rutaParaVolver, urlLogin, volverSeguro } from './volver'

describe('volverSeguro', () => {
  it.each(['/cofre', '/cofre?f=1', '/cofre?x=1#y', '/proyectos/3', '/calendario?mes=2026-11&dia=2026-11-17', '/loginx', '/'])(
    'acepta la ruta interna %s',
    (ruta) => {
      expect(volverSeguro(ruta)).toBe(ruta)
    },
  )

  it.each([
    null,
    undefined,
    '',
    'cofre',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/a\nb',
    '/a\tb',
    '/login',
    '/login?volver=/cofre',
    '/login/',
    '/login#x',
  ])('rechaza %j y da «/»', (valor) => {
    expect(volverSeguro(valor)).toBe('/')
  })
})

describe('rutaParaVolver y urlLogin', () => {
  it('junta ruta, búsqueda y ancla', () => {
    expect(rutaParaVolver({ pathname: '/cofre', search: '?f=1', hash: '#a' })).toBe('/cofre?f=1#a')
  })

  it('codifica el destino', () => {
    expect(urlLogin('/cofre?f=1')).toBe('/login?volver=%2Fcofre%3Ff%3D1')
  })

  it('desde la raíz no añade volver', () => {
    expect(urlLogin('/')).toBe('/login')
  })
})
