import { describe, expect, it } from 'vitest'

import { tarea } from '@/features/cofre/fabrica'
import { candidatasTareaParaDestino, candidatosParaTarea, nombreDe } from './candidatosVinculo'
import { objetivo, proyecto } from './fabrica'

describe('nombreDe', () => {
  it('devuelve el nombre, o «n.º N» si falta o no hay lista', () => {
    const lista = [proyecto({ id: 3, nombre: 'Mudanza' })]
    expect(nombreDe(lista, 3)).toBe('Mudanza')
    expect(nombreDe(lista, 9)).toBe('n.º 9')
    expect(nombreDe(undefined, 3)).toBe('n.º 3')
  })
})

describe('candidatosParaTarea', () => {
  const items = [
    proyecto({ id: 1, nombre: 'Zeta' }),
    proyecto({ id: 2, nombre: 'Álamo', estado: 'EN_PROGRESO' }),
    proyecto({ id: 3, nombre: 'Cerrado', estado: 'HECHO' }),
    proyecto({ id: 4, nombre: 'Cancelado', estado: 'CANCELADO' }),
  ]

  it('ofrece los abiertos ordenados por nombre sin tildes', () => {
    expect(candidatosParaTarea(items, null).map((c) => c.item.id)).toEqual([2, 1])
  })

  it('suma el vigente aunque esté cerrado y lo marca', () => {
    const c = candidatosParaTarea(items, 3)
    expect(c.map((x) => x.item.id)).toEqual([2, 3, 1])
    expect(c.find((x) => x.item.id === 3)?.detalle).toBe('Actual · Hecho')
    expect(c.find((x) => x.item.id === 1)?.detalle).toBe('Pendiente')
  })

  it('sirve igual para objetivos', () => {
    expect(candidatosParaTarea([objetivo({ id: 5, nombre: 'Salud' })], null)).toHaveLength(1)
  })
})

describe('candidatasTareaParaDestino', () => {
  const proyectos = [proyecto({ id: 7, nombre: 'Mudanza' })]
  const todas = [
    tarea({ id: 1, titulo: 'Ya es suya', proyectoId: 10 }),
    tarea({ id: 2, titulo: 'Suelta', fecha: '2026-11-12' }),
    tarea({ id: 3, titulo: 'De otro', proyectoId: 7 }),
    tarea({ id: 4, titulo: 'Hecha', estado: 'HECHO' }),
    tarea({ id: 5, titulo: 'Cancelada', estado: 'CANCELADO' }),
    tarea({ id: 6, titulo: 'Del objetivo', objetivoId: 10 }),
  ]

  it('excluye las ya ligadas al destino y las cerradas', () => {
    expect(candidatasTareaParaDestino('proyecto', 10, todas, proyectos).map((c) => c.tarea.id)).toEqual([3, 6, 2])
  })

  it('rotula las sueltas y avisa que se moverá a las de otro', () => {
    const c = candidatasTareaParaDestino('proyecto', 10, todas, proyectos)
    expect(c.find((x) => x.tarea.id === 3)?.detalle).toBe('Ahora es del proyecto «Mudanza»; se moverá')
    expect(c.find((x) => x.tarea.id === 2)?.detalle).toBe('Sin proyecto · 12 de noviembre')
  })

  it('sin la lista de nombres usa «n.º N»', () => {
    const c = candidatasTareaParaDestino('proyecto', 10, todas, undefined)
    expect(c.find((x) => x.tarea.id === 3)?.detalle).toBe('Ahora es del proyecto «n.º 7»; se moverá')
  })

  it('proyecto y objetivo son independientes: mira solo su campo', () => {
    const c = candidatasTareaParaDestino('objetivo', 10, todas, [])
    expect(c.map((x) => x.tarea.id)).toEqual([3, 2, 1])
    expect(c.find((x) => x.tarea.id === 3)?.detalle).toBe('Sin objetivo · sin fecha')
  })
})
