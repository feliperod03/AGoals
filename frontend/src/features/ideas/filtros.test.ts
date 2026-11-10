import { describe, expect, it } from 'vitest'

import { proyecto } from '@/features/jerarquia/fabrica'
import { idea } from './fabrica'
import { FILTROS_POR_DEFECTO, filtrarIdeas, hayFiltrosActivos, ordenarIdeas, textoVacioIdeas, todosComoCandidatos, type FiltrosIdeas } from './filtros'

const f = (parcial: Partial<FiltrosIdeas>): FiltrosIdeas => ({ ...FILTROS_POR_DEFECTO, ...parcial })

const ideas = [
  idea({ id: 1, titulo: 'Aprender a cantar', descripcion: 'En un coro' }),
  idea({ id: 2, titulo: 'Pintar la sala', estado: 'CONCLUIDA', proyectoId: 5, conclusion: 'Listo', fechaCierre: '2026-11-05T10:00:00-03:00' }),
  idea({ id: 3, titulo: 'Viajar', objetivoId: 8 }),
  idea({ id: 4, titulo: 'Acción diaria', descripcion: null, proyectoId: 6 }),
]
const ids = (lista: { id: number }[]) => lista.map((i) => i.id)

describe('filtrarIdeas', () => {
  it('por defecto muestra solo las planteadas', () => {
    expect(ids(filtrarIdeas(ideas, FILTROS_POR_DEFECTO))).toEqual([1, 3, 4])
  })

  it('filtra por estado', () => {
    expect(ids(filtrarIdeas(ideas, f({ estado: 'concluidas' })))).toEqual([2])
    expect(ids(filtrarIdeas(ideas, f({ estado: 'todas' })))).toEqual([1, 2, 3, 4])
  })

  it('filtra por vínculo: sueltas, de un proyecto, de un objetivo, uno concreto', () => {
    const todas = { estado: 'todas' } as const
    expect(ids(filtrarIdeas(ideas, f({ ...todas, vinculo: { tipo: 'sueltas' } })))).toEqual([1])
    expect(ids(filtrarIdeas(ideas, f({ ...todas, vinculo: { tipo: 'proyecto', id: null } })))).toEqual([2, 4])
    expect(ids(filtrarIdeas(ideas, f({ ...todas, vinculo: { tipo: 'proyecto', id: 6 } })))).toEqual([4])
    expect(ids(filtrarIdeas(ideas, f({ ...todas, vinculo: { tipo: 'objetivo', id: null } })))).toEqual([3])
    expect(ids(filtrarIdeas(ideas, f({ ...todas, vinculo: { tipo: 'objetivo', id: 99 } })))).toEqual([])
  })

  it('busca en título y descripción sin tildes ni mayúsculas (la descripción puede ser null)', () => {
    expect(ids(filtrarIdeas(ideas, f({ busqueda: 'ACCION' })))).toEqual([4])
    expect(ids(filtrarIdeas(ideas, f({ busqueda: ' coro ' })))).toEqual([1])
    expect(ids(filtrarIdeas(ideas, f({ busqueda: 'inexistente' })))).toEqual([])
  })

  it('combina los criterios con AND', () => {
    expect(ids(filtrarIdeas(ideas, f({ vinculo: { tipo: 'proyecto', id: null }, busqueda: 'accion' })))).toEqual([4])
    expect(ids(filtrarIdeas(ideas, f({ estado: 'concluidas', busqueda: 'cantar' })))).toEqual([])
  })
})

describe('ordenarIdeas', () => {
  it('más recientes primero y desempata por id descendente', () => {
    const lista = [
      idea({ id: 1, fechaCreacion: '2026-11-01T10:00:00-03:00' }),
      idea({ id: 2, fechaCreacion: '2026-11-03T10:00:00-03:00' }),
      idea({ id: 3, fechaCreacion: '2026-11-03T10:00:00-03:00' }),
    ]
    expect(ids(ordenarIdeas(lista))).toEqual([3, 2, 1])
  })

  it('no modifica el arreglo recibido', () => {
    const lista = [idea({ id: 1 }), idea({ id: 2, fechaCreacion: '2026-11-09T10:00:00-03:00' })]
    ordenarIdeas(lista)
    expect(ids(lista)).toEqual([1, 2])
  })

  it('las concluidas se ordenan por fecha de cierre, no por la de creación', () => {
    const lista = [
      idea({ id: 1, estado: 'CONCLUIDA', fechaCreacion: '2026-10-01T10:00:00-03:00', fechaCierre: '2026-11-08T10:00:00-03:00' }),
      idea({ id: 2, estado: 'CONCLUIDA', fechaCreacion: '2026-11-01T10:00:00-03:00', fechaCierre: '2026-11-02T10:00:00-03:00' }),
    ]
    expect(ids(ordenarIdeas(lista))).toEqual([1, 2])
  })

  it('«Todas» mezcla fechaCierre (concluidas) con fechaCreacion (planteadas)', () => {
    const lista = [
      // Creada hace mucho, pero cerrada el 9: va por el 9 de noviembre.
      idea({ id: 1, estado: 'CONCLUIDA', fechaCreacion: '2026-09-01T10:00:00-03:00', fechaCierre: '2026-11-09T10:00:00-03:00' }),
      // Planteada creada el 8: va por el 8.
      idea({ id: 2, fechaCreacion: '2026-11-08T10:00:00-03:00' }),
      // Concluida creada el 10 pero cerrada el 7: va por el 7, detrás de la planteada del 8.
      idea({ id: 3, estado: 'CONCLUIDA', fechaCreacion: '2026-11-10T08:00:00-03:00', fechaCierre: '2026-11-07T10:00:00-03:00' }),
    ]
    expect(ids(ordenarIdeas(lista))).toEqual([1, 2, 3])
  })

  it('una concluida sin fechaCierre cae a su fecha de creación', () => {
    const lista = [
      idea({ id: 1, estado: 'CONCLUIDA', fechaCierre: null, fechaCreacion: '2026-11-09T10:00:00-03:00' }),
      idea({ id: 2, fechaCreacion: '2026-11-05T10:00:00-03:00' }),
    ]
    expect(ids(ordenarIdeas(lista))).toEqual([1, 2])
  })
})

describe('textoVacioIdeas', () => {
  const nombres = { proyectos: [{ id: 5, nombre: 'Casa' }], objetivos: [{ id: 8, nombre: 'Salud' }] }

  it('con la vista por defecto no habla de filtros', () => {
    expect(textoVacioIdeas(FILTROS_POR_DEFECTO, nombres)).toBe('No hay ideas planteadas.')
  })

  it('nombra todos los filtros activos', () => {
    expect(textoVacioIdeas(f({ estado: 'concluidas' }), nombres)).toBe('No hay ideas con estos filtros: Concluidas.')
    expect(textoVacioIdeas(f({ vinculo: { tipo: 'sueltas' }, busqueda: ' sol ' }), nombres)).toBe(
      'No hay ideas con estos filtros: Planteadas, Sueltas, Título o descripción contiene «sol».',
    )
    expect(textoVacioIdeas(f({ estado: 'todas', vinculo: { tipo: 'proyecto', id: 5 } }), nombres)).toBe('No hay ideas con estos filtros: Del proyecto «Casa».')
    expect(textoVacioIdeas(f({ vinculo: { tipo: 'objetivo', id: 8 } }), nombres)).toBe('No hay ideas con estos filtros: Planteadas, Del objetivo «Salud».')
    expect(textoVacioIdeas(f({ vinculo: { tipo: 'objetivo', id: null } }), nombres)).toContain('De algún objetivo')
  })

  it('usa «n.º N» si la lista de nombres no cargó', () => {
    expect(textoVacioIdeas(f({ vinculo: { tipo: 'proyecto', id: 5 } }), { proyectos: undefined, objetivos: undefined })).toContain('«n.º 5»')
  })

  it('con «Todas» y nada más no deja la lista vacía tras los dos puntos', () => {
    expect(textoVacioIdeas(f({ estado: 'todas' }), nombres)).toBe('No hay ideas.')
  })
})

describe('hayFiltrosActivos', () => {
  it('detecta cualquier desvío de la vista por defecto', () => {
    expect(hayFiltrosActivos(FILTROS_POR_DEFECTO)).toBe(false)
    expect(hayFiltrosActivos(f({ estado: 'todas' }))).toBe(true)
    expect(hayFiltrosActivos(f({ busqueda: 'a' }))).toBe(true)
    expect(hayFiltrosActivos(f({ vinculo: { tipo: 'sueltas' } }))).toBe(true)
  })
})

describe('todosComoCandidatos', () => {
  it('incluye también los cerrados, ordenados por nombre, con su estado', () => {
    const lista = [proyecto({ id: 1, nombre: 'Zeta' }), proyecto({ id: 2, nombre: 'Alfa', estado: 'HECHO' })]
    expect(todosComoCandidatos(lista).map((c) => [c.texto, c.detalle])).toEqual([
      ['Alfa', 'Hecho'],
      ['Zeta', 'Pendiente'],
    ])
  })
})
