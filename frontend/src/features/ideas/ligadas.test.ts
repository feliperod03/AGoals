import { describe, expect, it } from 'vitest'

import { idea } from './fabrica'
import { ideasLigadas, LIMITE_IDEAS_LIGADAS, rutaIdeasDe, textoMasIdeas } from './ligadas'

const ids = (r: { visibles: { id: number }[] }) => r.visibles.map((i) => i.id)

describe('ideasLigadas', () => {
  const ideas = [
    idea({ id: 1, proyectoId: 3 }),
    idea({ id: 2, proyectoId: 4 }),
    idea({ id: 3, objetivoId: 3 }),
    idea({ id: 4 }),
    idea({ id: 5, objetivoId: 9 }),
  ]

  it('del proyecto: solo el vínculo directo con ese id; ignora otros ids y las sueltas', () => {
    expect(ids(ideasLigadas(ideas, 'proyectoId', 3))).toEqual([1])
    expect(ids(ideasLigadas(ideas, 'proyectoId', 4))).toEqual([2])
  })

  it('del objetivo: solo el vínculo directo con ese id', () => {
    expect(ids(ideasLigadas(ideas, 'objetivoId', 9))).toEqual([5])
  })

  it('una idea de proyecto con id N no aparece en un objetivo con el mismo id N (y al revés)', () => {
    expect(ids(ideasLigadas(ideas, 'objetivoId', 3))).toEqual([3])
    expect(ids(ideasLigadas(ideas, 'proyectoId', 3))).toEqual([1])
  })

  it('sin ideas ligadas: todo en cero', () => {
    expect(ideasLigadas(ideas, 'proyectoId', 99)).toEqual({ visibles: [], ocultas: 0, total: 0 })
  })

  it('más recientes primero: la concluida por su cierre, la planteada por su creación', () => {
    const r = ideasLigadas(
      [
        idea({ id: 1, proyectoId: 1, fechaCreacion: '2026-11-01T10:00:00-03:00' }),
        idea({ id: 2, proyectoId: 1, fechaCreacion: '2026-10-01T10:00:00-03:00', estado: 'CONCLUIDA', fechaCierre: '2026-11-05T10:00:00-03:00' }),
        idea({ id: 3, proyectoId: 1, fechaCreacion: '2026-11-03T10:00:00-03:00' }),
      ],
      'proyectoId',
      1,
    )
    expect(ids(r)).toEqual([2, 3, 1])
  })

  it('mezcla planteadas y concluidas', () => {
    const r = ideasLigadas([idea({ id: 1, proyectoId: 1 }), idea({ id: 2, proyectoId: 1, estado: 'CONCLUIDA', fechaCierre: '2026-11-02T10:00:00-03:00' })], 'proyectoId', 1)
    expect(r.visibles.map((i) => i.estado).sort()).toEqual(['CONCLUIDA', 'PLANTEADA'])
  })

  it('límite: muestra 5 y cuenta las ocultas; con exactamente 5 no hay ocultas', () => {
    const seis = Array.from({ length: 6 }, (_, n) => idea({ id: n + 1, proyectoId: 1, fechaCreacion: `2026-11-0${n + 1}T10:00:00-03:00` }))
    const r = ideasLigadas(seis, 'proyectoId', 1)
    expect(LIMITE_IDEAS_LIGADAS).toBe(5)
    expect(r.total).toBe(6)
    expect(r.ocultas).toBe(1)
    expect(ids(r)).toEqual([6, 5, 4, 3, 2])
    expect(ideasLigadas(seis.slice(0, 5), 'proyectoId', 1).ocultas).toBe(0)
  })

  it('no modifica el arreglo recibido', () => {
    const copia = [...ideas]
    ideasLigadas(ideas, 'proyectoId', 3)
    expect(ideas).toEqual(copia)
  })
})

describe('textos y rutas', () => {
  it('«+N más»', () => expect(textoMasIdeas(3)).toBe('+3 más'))
  it('ruta a Ideas con el vínculo', () => {
    expect(rutaIdeasDe('proyectoId', 7)).toBe('/ideas?proyecto=7')
    expect(rutaIdeasDe('objetivoId', 2)).toBe('/ideas?objetivo=2')
  })
})
