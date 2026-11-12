import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLAVE_TEMA, esOscuro, guardarPreferencia, leerPreferencia, siguientePreferencia } from './tema'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('leerPreferencia', () => {
  it('sin nada guardado sigue al sistema', () => {
    expect(leerPreferencia()).toBe('sistema')
  })

  it.each(['claro', 'oscuro'] as const)('devuelve %s si está guardado', (valor) => {
    localStorage.setItem(CLAVE_TEMA, valor)
    expect(leerPreferencia()).toBe(valor)
  })

  it.each(['azul', '"oscuro"', 'sistema', '', 'OSCURO'])('un valor inválido (%j) cae a sistema', (valor) => {
    localStorage.setItem(CLAVE_TEMA, valor)
    expect(leerPreferencia()).toBe('sistema')
  })

  it('si localStorage falla, cae a sistema', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin acceso')
    })
    expect(leerPreferencia()).toBe('sistema')
  })
})

describe('guardarPreferencia', () => {
  it('guarda claro y oscuro', () => {
    guardarPreferencia('claro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
    guardarPreferencia('oscuro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro')
  })

  it('sistema borra la clave', () => {
    localStorage.setItem(CLAVE_TEMA, 'oscuro')
    guardarPreferencia('sistema')
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull()
  })

  it('si localStorage falla, no propaga el error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota')
    })
    expect(() => guardarPreferencia('oscuro')).not.toThrow()
  })
})

describe('esOscuro y siguientePreferencia', () => {
  it('sistema obedece al sistema; las otras lo ignoran', () => {
    expect(esOscuro('sistema', true)).toBe(true)
    expect(esOscuro('sistema', false)).toBe(false)
    expect(esOscuro('claro', true)).toBe(false)
    expect(esOscuro('oscuro', false)).toBe(true)
  })

  it('cicla sistema → claro → oscuro → sistema', () => {
    expect(siguientePreferencia('sistema')).toBe('claro')
    expect(siguientePreferencia('claro')).toBe('oscuro')
    expect(siguientePreferencia('oscuro')).toBe('sistema')
  })
})

describe('script de index.html', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

  const casos: [string | null, boolean][] = [
    [null, false],
    [null, true],
    ['claro', true],
    ['claro', false],
    ['oscuro', false],
    ['oscuro', true],
    ['basura', true],
    ['basura', false],
  ]

  it.each(casos)('con %j guardado y sistema oscuro=%s aplica lo mismo que tema.ts', (guardado, sistemaOscuro) => {
    expect(script).not.toBe('')
    vi.stubGlobal('matchMedia', () => ({ matches: sistemaOscuro }))
    if (guardado !== null) localStorage.setItem(CLAVE_TEMA, guardado)
    const esperado = esOscuro(leerPreferencia(), sistemaOscuro)
    new Function(script)()
    expect(document.documentElement.classList.contains('dark')).toBe(esperado)
  })

  it('no rompe si localStorage falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin acceso')
    })
    expect(() => new Function(script)()).not.toThrow()
  })
})
