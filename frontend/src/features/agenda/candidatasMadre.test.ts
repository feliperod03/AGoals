import { describe, expect, it } from 'vitest'

import type { Tarea } from '@/types/tarea'
import { candidatasMadre } from './candidatasMadre'

function t(id: number, titulo: string, parcial: Partial<Tarea> = {}): Tarea {
  return {
    id,
    titulo,
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: null,
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

const ids = (cs: ReturnType<typeof candidatasMadre>) => cs.map((c) => c.tarea.id)

describe('candidatasMadre', () => {
  it('excluye la propia tarea y sus descendientes en todos los niveles', () => {
    const yo = t(1, 'Yo')
    const todas = [yo, t(2, 'Hija', { padreId: 1 }), t(3, 'Nieta', { padreId: 2 }), t(4, 'Bisnieta', { padreId: 3 }), t(5, 'Ajena')]
    expect(ids(candidatasMadre(yo, todas))).toEqual([5])
  })

  it('no se cuelga con un ciclo en los datos', () => {
    const a = t(1, 'A', { padreId: 2 })
    const todas = [a, t(2, 'B', { padreId: 1 }), t(3, 'C')]
    expect(ids(candidatasMadre(a, todas))).toEqual([3])
  })

  it('incluye abiertas y excluye cerradas ajenas', () => {
    const yo = t(1, 'Yo')
    const todas = [
      yo,
      t(2, 'Pendiente'),
      t(3, 'En progreso', { estado: 'EN_PROGRESO' }),
      t(4, 'En pausa', { estado: 'EN_PAUSA' }),
      t(5, 'Hecha', { estado: 'HECHO' }),
      t(6, 'Cancelada', { estado: 'CANCELADO' }),
    ]
    expect(ids(candidatasMadre(yo, todas)).sort()).toEqual([2, 3, 4])
  })

  it('incluye la madre actual aunque esté cerrada', () => {
    const yo = t(1, 'Yo', { padreId: 7 })
    const todas = [yo, t(7, 'Madre cerrada', { estado: 'HECHO' }), t(8, 'Otra cerrada', { estado: 'CANCELADO' })]
    expect(ids(candidatasMadre(yo, todas))).toEqual([7])
  })

  it('ordena por título sin distinguir tildes ni mayúsculas', () => {
    const yo = t(1, 'Yo')
    const todas = [yo, t(2, 'zorro'), t(3, 'Árbol'), t(4, 'casa'), t(5, 'Ábaco')]
    expect(candidatasMadre(yo, todas).map((c) => c.tarea.titulo)).toEqual(['Ábaco', 'Árbol', 'casa', 'zorro'])
  })

  it('el detalle distingue títulos repetidos (madre y fecha)', () => {
    const yo = t(1, 'Yo')
    const todas = [yo, t(2, 'Mudanza'), t(3, 'Comprar', { fecha: '2026-11-12' }), t(4, 'Comprar', { padreId: 2 })]
    const comprar = candidatasMadre(yo, todas).filter((c) => c.tarea.titulo === 'Comprar')
    expect(comprar.map((c) => c.detalle)).toEqual(['Tarea principal · 12 de noviembre', 'Subtarea de «Mudanza» · sin fecha'])
  })
})
