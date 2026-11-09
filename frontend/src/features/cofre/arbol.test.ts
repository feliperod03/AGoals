import { describe, expect, it } from 'vitest'

import { armarArbol, subtareasCandidatas, type NodoCofre } from './arbol'
import { tarea } from './fabrica'

const HOY = '2026-11-10'
const forma = (nodos: NodoCofre[]): unknown[] => nodos.map((n) => (n.subtareas.length ? [n.tarea.id, forma(n.subtareas)] : n.tarea.id))

describe('armarArbol', () => {
  it('anida las hijas en todos los niveles y conserva el orden recibido', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, padreId: 1 }), tarea({ id: 3, padreId: 2 }), tarea({ id: 4, padreId: 1 }), tarea({ id: 5 })]
    expect(forma(armarArbol(ts, ts))).toEqual([[1, [[2, [3]], 4]], 5])
  })

  it('una madre que no cumple el filtro no se muestra y su hija pasa a raíz con la marca de la madre', () => {
    const todas = [tarea({ id: 1, titulo: 'Madre' }), tarea({ id: 2, padreId: 1 })]
    const arbol = armarArbol(todas, [todas[1]!])
    expect(forma(arbol)).toEqual([2])
    expect(arbol[0]!.madre).toBe('Madre')
  })

  it('las raíces de verdad y las hijas anidadas no llevan marca', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, padreId: 1 })]
    const arbol = armarArbol(ts, ts)
    expect(arbol[0]!.madre).toBeNull()
    expect(arbol[0]!.subtareas[0]!.madre).toBeNull()
  })

  it('una hija con padre inexistente es raíz sin marca', () => {
    const ts = [tarea({ id: 2, padreId: 99 })]
    const arbol = armarArbol(ts, ts)
    expect(forma(arbol)).toEqual([2])
    expect(arbol[0]!.madre).toBeNull()
  })

  it('cuenta las hijas directas que el filtro dejó fuera', () => {
    const todas = [tarea({ id: 1 }), tarea({ id: 2, padreId: 1 }), tarea({ id: 3, padreId: 1 }), tarea({ id: 4, padreId: 3 })]
    const arbol = armarArbol(todas, [todas[0]!, todas[1]!])
    expect(arbol[0]!.ocultas).toBe(1)
    expect(arbol[0]!.subtareas[0]!.ocultas).toBe(0)
  })

  it('un ciclo no rompe nada: se promueve una raíz y se corta la recursión', () => {
    const ts = [tarea({ id: 1, padreId: 2, titulo: 'A' }), tarea({ id: 2, padreId: 1, titulo: 'B' })]
    expect(forma(armarArbol(ts, ts))).toEqual([[1, [2]]])
  })

  it('sin tareas devuelve vacío', () => {
    expect(armarArbol([], [])).toEqual([])
  })
})

describe('subtareasCandidatas', () => {
  const ids = (ts: { id: number }[]) => ts.map((t) => t.id).sort((a, b) => a - b)

  it('incluye abiertas sin fecha o atrasadas, en todos los niveles', () => {
    const ts = [
      tarea({ id: 1 }),
      tarea({ id: 2, padreId: 1 }),
      tarea({ id: 3, padreId: 2, fecha: '2026-11-01' }),
      tarea({ id: 4, padreId: 1, estado: 'EN_PROGRESO' }),
    ]
    expect(ids(subtareasCandidatas(ts[0]!, ts, HOY))).toEqual([2, 3, 4])
  })

  it('una hija de hoy, futura o cerrada no entra y corta su rama', () => {
    const ts = [
      tarea({ id: 1 }),
      tarea({ id: 2, padreId: 1, fecha: HOY }),
      tarea({ id: 3, padreId: 2 }),
      tarea({ id: 4, padreId: 1, fecha: '2026-11-20' }),
      tarea({ id: 5, padreId: 4 }),
      tarea({ id: 6, padreId: 1, estado: 'HECHO' }),
      tarea({ id: 7, padreId: 6 }),
      tarea({ id: 8, padreId: 1, estado: 'CANCELADO' }),
      tarea({ id: 9, padreId: 1 }),
    ]
    expect(ids(subtareasCandidatas(ts[0]!, ts, HOY))).toEqual([9])
  })

  it('no incluye a la propia tarea y resiste los ciclos', () => {
    const ts = [tarea({ id: 1, padreId: 2 }), tarea({ id: 2, padreId: 1 })]
    expect(ids(subtareasCandidatas(ts[0]!, ts, HOY))).toEqual([2])
  })

  it('sin hijas devuelve vacío', () => {
    const ts = [tarea({ id: 1 })]
    expect(subtareasCandidatas(ts[0]!, ts, HOY)).toEqual([])
  })
})
