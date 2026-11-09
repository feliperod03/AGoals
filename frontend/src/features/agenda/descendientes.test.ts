import { describe, expect, it } from 'vitest'

import { tarea } from '@/features/cofre/fabrica'
import { ancestrosDe, descendientesDe } from './descendientes'

const ids = (r: { todos: { id: number }[] }) => r.todos.map((t) => t.id).sort((a, b) => a - b)

describe('descendientesDe', () => {
  it('una tarea sin hijas no tiene descendientes', () => {
    expect(descendientesDe(1, [tarea({ id: 1 }), tarea({ id: 2 })])).toEqual({ todos: [], directos: 0 })
  })

  it('cuenta todos los niveles y distingue los directos', () => {
    const todas = [
      tarea({ id: 1 }),
      tarea({ id: 2, padreId: 1 }),
      tarea({ id: 3, padreId: 1 }),
      tarea({ id: 4, padreId: 2 }),
      tarea({ id: 5, padreId: 4 }),
      tarea({ id: 6 }),
      tarea({ id: 7, padreId: 6 }),
    ]
    const r = descendientesDe(1, todas)
    expect(ids(r)).toEqual([2, 3, 4, 5])
    expect(r.directos).toBe(2)
    expect(ids(descendientesDe(2, todas))).toEqual([4, 5])
  })

  it('no se cuelga con un ciclo ni se cuenta a sí misma', () => {
    const ciclo = [tarea({ id: 1, padreId: 2 }), tarea({ id: 2, padreId: 1 }), tarea({ id: 3, padreId: 3 })]
    expect(ids(descendientesDe(1, ciclo))).toEqual([2])
    expect(descendientesDe(1, ciclo).directos).toBe(1)
    expect(descendientesDe(3, ciclo)).toEqual({ todos: [], directos: 0 })
  })
})

describe('ancestrosDe', () => {
  const idsDe = (r: { id: number }[]) => r.map((t) => t.id)

  it('sube por las madres, de la más cercana a la más lejana', () => {
    const todas = [tarea({ id: 1 }), tarea({ id: 2, padreId: 1 }), tarea({ id: 3, padreId: 2 })]
    expect(idsDe(ancestrosDe(3, todas))).toEqual([2, 1])
    expect(ancestrosDe(1, todas)).toEqual([])
  })

  it('no se cuelga con un ciclo ni se incluye a sí misma', () => {
    const ciclo = [tarea({ id: 1, padreId: 2 }), tarea({ id: 2, padreId: 1 }), tarea({ id: 3, padreId: 3 })]
    expect(idsDe(ancestrosDe(1, ciclo))).toEqual([2])
    expect(ancestrosDe(3, ciclo)).toEqual([])
  })

  it('una madre inexistente corta la subida', () => {
    expect(ancestrosDe(2, [tarea({ id: 2, padreId: 99 })])).toEqual([])
  })
})
