import { describe, expect, it } from 'vitest'

import { tarea as t } from '@/features/cofre/fabrica'
import { candidatasSubtarea } from './candidatasSubtarea'

const ids = (cs: ReturnType<typeof candidatasSubtarea>) => cs.map((c) => c.tarea.id)

describe('candidatasSubtarea', () => {
  it('excluye la madre, sus ancestros en varios niveles y sus subtareas directas', () => {
    const x = t({ id: 4, titulo: 'X', padreId: 3 })
    const todas = [
      t({ id: 1, titulo: 'Abuela' }),
      t({ id: 2, titulo: 'Tia', padreId: 1 }),
      t({ id: 3, titulo: 'Madre', padreId: 2 }),
      x,
      t({ id: 5, titulo: 'Hija', padreId: 4 }),
      t({ id: 6, titulo: 'Ajena' }),
    ]
    expect(ids(candidatasSubtarea(x, todas))).toEqual([6])
  })

  it('incluye a las nietas (no son subtareas directas)', () => {
    const x = t({ id: 1, titulo: 'X' })
    const todas = [x, t({ id: 2, titulo: 'Hija', padreId: 1 }), t({ id: 3, titulo: 'Nieta', padreId: 2 })]
    expect(ids(candidatasSubtarea(x, todas))).toEqual([3])
  })

  it('no se cuelga con un ciclo en los datos', () => {
    const x = t({ id: 1, titulo: 'X', padreId: 2 })
    const todas = [x, t({ id: 2, titulo: 'B', padreId: 1 }), t({ id: 3, titulo: 'C' })]
    expect(ids(candidatasSubtarea(x, todas))).toEqual([3])
  })

  it('excluye las cerradas e incluye las abiertas', () => {
    const x = t({ id: 1, titulo: 'X' })
    const todas = [
      x,
      t({ id: 2, titulo: 'A', estado: 'HECHO' }),
      t({ id: 3, titulo: 'B', estado: 'CANCELADO' }),
      t({ id: 4, titulo: 'C', estado: 'EN_PROGRESO' }),
      t({ id: 5, titulo: 'D', estado: 'EN_PAUSA' }),
      t({ id: 6, titulo: 'E' }),
    ]
    expect(ids(candidatasSubtarea(x, todas))).toEqual([4, 5, 6])
  })

  it('el detalle avisa que se moverá si ya tiene otra madre, y muestra la fecha o "sin fecha"', () => {
    const x = t({ id: 1, titulo: 'X' })
    const todas = [x, t({ id: 2, titulo: 'Z' }), t({ id: 3, titulo: 'Con madre', padreId: 2, fecha: '2026-11-12' }), t({ id: 4, titulo: 'Suelta' })]
    const detalles = Object.fromEntries(candidatasSubtarea(x, todas).map((c) => [c.tarea.id, c.detalle]))
    expect(detalles[3]).toBe('Ahora es subtarea de «Z»; se moverá · 12 de noviembre')
    expect(detalles[4]).toBe('Tarea principal · sin fecha')
  })

  it('ordena por título sin tildes ni mayúsculas', () => {
    const x = t({ id: 1, titulo: 'X' })
    const todas = [x, t({ id: 2, titulo: 'zeta' }), t({ id: 3, titulo: 'Árbol' }), t({ id: 4, titulo: 'beta' })]
    expect(ids(candidatasSubtarea(x, todas))).toEqual([3, 4, 2])
  })
})
