import { describe, expect, it } from 'vitest'

import { normalizarTexto } from './texto'

describe('normalizarTexto', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarTexto('Acción Social')).toBe('accion social')
    expect(normalizarTexto('ÑANDÚ')).toBe('nandu')
  })
  it('deja igual lo que ya está normalizado', () => {
    expect(normalizarTexto('hola 123')).toBe('hola 123')
  })
})
