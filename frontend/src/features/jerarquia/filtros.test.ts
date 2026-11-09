import { describe, expect, it } from 'vitest'

import { proyecto } from './fabrica'
import { FILTROS_POR_DEFECTO, cumpleEstado, filtrar, hayFiltrosActivos, ordenar } from './filtros'

const ITEMS = [
  proyecto({ id: 1, nombre: 'Mudanza', estado: 'EN_PROGRESO' }),
  proyecto({ id: 2, nombre: 'Acción social', estado: 'PENDIENTE' }),
  proyecto({ id: 3, nombre: 'Viejo', estado: 'HECHO' }),
  proyecto({ id: 4, nombre: 'Descartado', estado: 'CANCELADO' }),
  proyecto({ id: 5, nombre: 'En pausa', estado: 'EN_PAUSA' }),
]
const ids = (xs: { id: number }[]) => xs.map((x) => x.id)

describe('filtrar', () => {
  it('por defecto muestra solo los abiertos', () => {
    expect(ids(filtrar(ITEMS, FILTROS_POR_DEFECTO))).toEqual([1, 2, 5])
  })

  it('«todos» no restringe y un estado concreto filtra solo ese', () => {
    expect(ids(filtrar(ITEMS, { estado: 'todos', busqueda: '' }))).toEqual([1, 2, 3, 4, 5])
    expect(ids(filtrar(ITEMS, { estado: 'HECHO', busqueda: '' }))).toEqual([3])
  })

  it('la búsqueda ignora mayúsculas y tildes, y se combina con el estado', () => {
    expect(ids(filtrar(ITEMS, { estado: 'todos', busqueda: 'ACCION' }))).toEqual([2])
    expect(ids(filtrar(ITEMS, { estado: 'abiertos', busqueda: 'viejo' }))).toEqual([])
    expect(ids(filtrar(ITEMS, { estado: 'todos', busqueda: '  viejo ' }))).toEqual([3])
  })
})

describe('cumpleEstado y hayFiltrosActivos', () => {
  it('cumpleEstado sigue las mismas reglas que filtrar', () => {
    expect(cumpleEstado('PENDIENTE', 'abiertos')).toBe(true)
    expect(cumpleEstado('HECHO', 'abiertos')).toBe(false)
    expect(cumpleEstado('CANCELADO', 'todos')).toBe(true)
    expect(cumpleEstado('EN_PAUSA', 'EN_PROGRESO')).toBe(false)
  })

  it('la vista por defecto no cuenta como filtrada; una búsqueda o un estado distinto, sí', () => {
    expect(hayFiltrosActivos(FILTROS_POR_DEFECTO)).toBe(false)
    expect(hayFiltrosActivos({ estado: 'abiertos', busqueda: '  ' })).toBe(false)
    expect(hayFiltrosActivos({ estado: 'abiertos', busqueda: 'x' })).toBe(true)
    expect(hayFiltrosActivos({ estado: 'todos', busqueda: '' })).toBe(true)
  })
})

describe('ordenar', () => {
  it('prioridad alta primero, sin prioridad al final; dentro de cada una, por nombre sin tildes; desempate por id', () => {
    const items = [
      proyecto({ id: 1, nombre: 'Zeta' }),
      proyecto({ id: 2, nombre: 'Ánimo', prioridad: 'BAJA' }),
      proyecto({ id: 3, nombre: 'beta', prioridad: 'ALTA' }),
      proyecto({ id: 4, nombre: 'Alfa', prioridad: 'ALTA' }),
      proyecto({ id: 5, nombre: 'Media', prioridad: 'MEDIA' }),
      proyecto({ id: 6, nombre: 'Alfa', prioridad: 'ALTA' }),
    ]
    expect(ids(ordenar(items))).toEqual([4, 6, 3, 5, 2, 1])
  })

  it('no modifica la lista original', () => {
    const items = [proyecto({ id: 1, nombre: 'B' }), proyecto({ id: 2, nombre: 'A' })]
    ordenar(items)
    expect(ids(items)).toEqual([1, 2])
  })
})
