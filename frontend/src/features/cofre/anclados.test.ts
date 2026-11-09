import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLAVE_ANCLADOS, guardarAnclados, leerAnclados } from './anclados'
import { ANCLADOS_POR_DEFECTO } from './filtros'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('leerAnclados', () => {
  it('usa los de fábrica si no hay nada guardado', () => {
    expect(leerAnclados()).toEqual([...ANCLADOS_POR_DEFECTO])
  })

  it('lee lo guardado y respeta el orden', () => {
    localStorage.setItem(CLAVE_ANCLADOS, JSON.stringify(['futuras', 'sueltas']))
    expect(leerAnclados()).toEqual(['futuras', 'sueltas'])
  })

  it('un arreglo vacío es válido (no anclar nada)', () => {
    localStorage.setItem(CLAVE_ANCLADOS, '[]')
    expect(leerAnclados()).toEqual([])
  })

  it.each([
    ['JSON roto', '{no es json'],
    ['no es un arreglo', '{"a":1}'],
    ['un número', '7'],
    ['null', 'null'],
    ['ids desconocidos', '["sinFecha","inventado"]'],
    ['tipos inesperados', '["sinFecha",3]'],
    ['repetidos', '["sinFecha","sinFecha"]'],
    ['más de tres', '["sinFecha","conFecha","atrasadas","futuras"]'],
  ])('si es inválido (%s) usa los de fábrica', (_, texto) => {
    localStorage.setItem(CLAVE_ANCLADOS, texto)
    expect(leerAnclados()).toEqual([...ANCLADOS_POR_DEFECTO])
  })

  it('si leer lanza (almacenamiento bloqueado) usa los de fábrica', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(leerAnclados()).toEqual([...ANCLADOS_POR_DEFECTO])
  })
})

describe('guardarAnclados', () => {
  it('guarda en JSON bajo la clave con prefijo agoals:', () => {
    guardarAnclados(['conFecha', 'sueltas'])
    expect(CLAVE_ANCLADOS).toBe('agoals:cofre:anclados')
    expect(localStorage.getItem(CLAVE_ANCLADOS)).toBe('["conFecha","sueltas"]')
  })

  it('si escribir lanza (cuota o modo privado) no propaga el error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota')
    })
    expect(() => guardarAnclados(['conFecha'])).not.toThrow()
  })
})
