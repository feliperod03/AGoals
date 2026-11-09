import { describe, expect, it } from 'vitest'

import { candidatosPadre, opcionesObjetivo } from './candidatosPadre'
import { objetivo, proyecto } from './fabrica'

const ROTULOS = { subDe: 'Subproyecto de', principal: 'Proyecto principal' }
const nombres = (xs: { item: { nombre: string } }[]) => xs.map((c) => c.item.nombre)

describe('candidatosPadre', () => {
  const todos = [
    proyecto({ id: 1, nombre: 'Casa' }),
    proyecto({ id: 2, nombre: 'Mudanza', padreId: 1 }),
    proyecto({ id: 3, nombre: 'Cajas', padreId: 2 }),
    proyecto({ id: 4, nombre: 'Cajas chicas', padreId: 3 }),
    proyecto({ id: 5, nombre: 'Otro' }),
  ]

  it('al crear ofrece todos los abiertos, ordenados por nombre', () => {
    expect(nombres(candidatosPadre(null, todos, ROTULOS))).toEqual(['Cajas', 'Cajas chicas', 'Casa', 'Mudanza', 'Otro'])
  })

  it('al editar excluye el propio ítem y todos sus descendientes (varios niveles)', () => {
    expect(nombres(candidatosPadre(todos[1]!, todos, ROTULOS))).toEqual(['Casa', 'Otro'])
  })

  it('un ítem sin descendientes solo se excluye a sí mismo', () => {
    expect(nombres(candidatosPadre(todos[3]!, todos, ROTULOS))).toEqual(['Cajas', 'Casa', 'Mudanza', 'Otro'])
  })

  it('no ofrece cerrados, salvo el padre actual', () => {
    const lista = [
      proyecto({ id: 1, nombre: 'Hecho', estado: 'HECHO' }),
      proyecto({ id: 2, nombre: 'Cancelado', estado: 'CANCELADO' }),
      proyecto({ id: 3, nombre: 'Hijo', padreId: 1 }),
      proyecto({ id: 4, nombre: 'Abierto' }),
    ]
    expect(nombres(candidatosPadre(lista[2]!, lista, ROTULOS))).toEqual(['Abierto', 'Hecho'])
  })

  it('un ciclo en los datos no cuelga y sigue excluyendo a los involucrados', () => {
    const ciclo = [proyecto({ id: 1, nombre: 'A', padreId: 2 }), proyecto({ id: 2, nombre: 'B', padreId: 1 }), proyecto({ id: 3, nombre: 'C' })]
    expect(nombres(candidatosPadre(ciclo[0]!, ciclo, ROTULOS))).toEqual(['C'])
  })

  it('el detalle dice de quién es subelemento, o que es principal', () => {
    const lista = candidatosPadre(todos[4]!, todos, ROTULOS)
    const detalle = (nombre: string) => lista.find((c) => c.item.nombre === nombre)?.detalle
    expect(detalle('Casa')).toBe('Proyecto principal')
    expect(detalle('Mudanza')).toBe('Subproyecto de «Casa»')
  })
})

describe('opcionesObjetivo', () => {
  const lista = [
    objetivo({ id: 1, nombre: 'Salud' }),
    objetivo({ id: 2, nombre: 'Casa', estado: 'HECHO' }),
    objetivo({ id: 3, nombre: 'Aprender' }),
  ]

  it('ofrece los abiertos por nombre', () => {
    expect(opcionesObjetivo(lista, null)).toEqual([
      { id: 3, texto: 'Aprender' },
      { id: 1, texto: 'Salud' },
    ])
  })

  it('incluye el objetivo actual aunque esté cerrado', () => {
    expect(opcionesObjetivo(lista, 2).map((o) => o.texto)).toEqual(['Aprender', 'Casa', 'Salud'])
  })

  it('con la lista sin cargar, el actual sigue estando (con su número)', () => {
    expect(opcionesObjetivo(undefined, 7)).toEqual([{ id: 7, texto: 'Objetivo n.º 7' }])
    expect(opcionesObjetivo(undefined, null)).toEqual([])
  })

  it('si el actual no está en la lista cargada, se agrega al comienzo con su número', () => {
    expect(opcionesObjetivo(lista, 99)[0]).toEqual({ id: 99, texto: 'Objetivo n.º 99' })
  })
})
