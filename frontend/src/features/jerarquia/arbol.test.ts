import { describe, expect, it } from 'vitest'

import { armarArbolJerarquia, type NodoJerarquia } from './arbol'
import { proyecto } from './fabrica'
import type { Proyecto } from '@/types/proyecto'

const p = (id: number, padreId: number | null = null, nombre = `P${id}`) => proyecto({ id, padreId, nombre })

/** Forma resumida: `id` y, entre paréntesis, los hijos. */
function forma(nodos: NodoJerarquia<Proyecto>[]): string {
  return nodos.map((n) => (n.hijos.length ? `${n.item.id}(${forma(n.hijos)})` : String(n.item.id))).join(',')
}

describe('armarArbolJerarquia', () => {
  it('anida los hijos bajo su padre y conserva el orden de entrada', () => {
    const todos = [p(1), p(2, 1), p(3, 1), p(4, 2), p(5)]
    expect(forma(armarArbolJerarquia(todos, todos))).toBe('1(2(4),3),5')
  })

  it('un padre inexistente deja al ítem como raíz, sin nombre de padre', () => {
    const todos = [p(2, 99)]
    const nodo = armarArbolJerarquia(todos, todos)[0]!
    expect(nodo.item.id).toBe(2)
    expect(nodo.padre).toBeNull()
  })

  it('un padre que no cumple el filtro: el hijo sube a raíz y nombra al padre', () => {
    const todos = [p(1, null, 'Mudanza'), p(2, 1)]
    const arbol = armarArbolJerarquia(todos, [todos[1]!])
    expect(arbol).toHaveLength(1)
    expect(arbol[0]!.item.id).toBe(2)
    expect(arbol[0]!.padre).toBe('Mudanza')
  })

  it('un padre que no cumple el filtro no se muestra', () => {
    const todos = [p(1), p(2, 1)]
    expect(armarArbolJerarquia(todos, [todos[1]!]).map((n) => n.item.id)).toEqual([2])
  })

  it('cuenta los hijos directos que el filtro dejó fuera', () => {
    const todos = [p(1), p(2, 1), p(3, 1), p(4, 3)]
    const raiz = armarArbolJerarquia(todos, [todos[0]!, todos[1]!])[0]!
    expect(raiz.ocultos).toBe(1) // solo el 3; el 4 es nieto
    expect(raiz.hijos[0]!.ocultos).toBe(0)
  })

  it('un ciclo A↔B no cuelga y muestra cada ítem una sola vez', () => {
    const todos = [p(1, 2), p(2, 1)]
    const arbol = armarArbolJerarquia(todos, todos)
    const ids: number[] = []
    const recorrer = (nodos: NodoJerarquia<Proyecto>[]) => nodos.forEach((n) => (ids.push(n.item.id), recorrer(n.hijos)))
    recorrer(arbol)
    expect(ids.sort()).toEqual([1, 2])
  })

  it('un ítem que es su propio padre no cuelga y queda como raíz', () => {
    const todos = [p(1, 1)]
    const arbol = armarArbolJerarquia(todos, todos)
    expect(arbol).toHaveLength(1)
    expect(arbol[0]!.hijos).toEqual([])
    expect(arbol[0]!.padre).toBeNull()
    expect(arbol[0]!.ocultos).toBe(0)
  })

  it('un ciclo largo (1→2→3→1) con una rama colgando se recorre completo', () => {
    const todos = [p(1, 3), p(2, 1), p(3, 2), p(4, 2)]
    const ids: number[] = []
    const recorrer = (nodos: NodoJerarquia<Proyecto>[]) => nodos.forEach((n) => (ids.push(n.item.id), recorrer(n.hijos)))
    recorrer(armarArbolJerarquia(todos, todos))
    expect(ids.sort()).toEqual([1, 2, 3, 4])
  })

  it('sin ítems devuelve un árbol vacío', () => {
    expect(armarArbolJerarquia([], [])).toEqual([])
  })
})
