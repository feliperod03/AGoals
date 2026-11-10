import { describe, expect, it } from 'vitest'

import type { ImpactoBorrado } from '@/types/impactoBorrado'
import {
  avisoRescatados,
  categoriasVisibles,
  eleccionesNormalizadas,
  parametrosDe,
  partesBorradas,
  plural,
  resumenBorrado,
  textoFila,
  unir,
  type DefCategoria,
} from './borrado'

const SUBOBJETIVOS: DefCategoria = { clave: 'subobjetivos', etiqueta: 'Subobjetivos', singular: 'subobjetivo', plural: 'subobjetivos', mover: 'Pasan al nivel superior', incluye: 'subobjetivos' }
const PROYECTOS: DefCategoria = { clave: 'proyectos', etiqueta: 'Proyectos', singular: 'proyecto', plural: 'proyectos', mover: 'Quedan sin objetivo', incluye: 'subproyectos' }
const TAREAS: DefCategoria = { clave: 'tareas', etiqueta: 'Tareas', singular: 'tarea', plural: 'tareas', mover: 'Quedan sueltas', incluye: 'subtareas' }
const IDEAS: DefCategoria = { clave: 'ideas', etiqueta: 'Ideas', singular: 'idea', plural: 'ideas', mover: 'Quedan sueltas' }
const CATEGORIAS: DefCategoria[] = [SUBOBJETIVOS, PROYECTOS, TAREAS, IDEAS]

const VACIO: ImpactoBorrado = {
  subobjetivos: { total: 0, borrados: 0 },
  proyectos: { total: 0, borrados: 0, rescatados: 0 },
  tareas: { total: 0, borrados: 0 },
  ideas: { total: 0, borrados: 0 },
}

describe('plural y unir', () => {
  it('singular solo con 1', () => {
    expect(plural(1, 'tarea', 'tareas')).toBe('1 tarea')
    expect(plural(0, 'tarea', 'tareas')).toBe('0 tareas')
    expect(plural(5, 'tarea', 'tareas')).toBe('5 tareas')
  })

  it('une con comas y «y» antes del último', () => {
    expect(unir([])).toBe('')
    expect(unir(['a'])).toBe('a')
    expect(unir(['a', 'b'])).toBe('a y b')
    expect(unir(['a', 'b', 'c'])).toBe('a, b y c')
  })
})

describe('categoriasVisibles y parametrosDe', () => {
  const impacto: ImpactoBorrado = { ...VACIO, proyectos: { total: 2, borrados: 0, rescatados: 0 }, tareas: { total: 3, borrados: 0 } }

  it('solo las categorías con total > 0, en el orden de la config', () => {
    expect(categoriasVisibles(impacto, CATEGORIAS).map((c) => c.clave)).toEqual(['proyectos', 'tareas'])
    expect(categoriasVisibles(VACIO, CATEGORIAS)).toEqual([])
  })

  it('manda un valor explícito por fila visible y por defecto conservar', () => {
    const visibles = categoriasVisibles(impacto, CATEGORIAS)
    expect(parametrosDe({}, visibles)).toEqual({ proyectos: 'conservar', tareas: 'conservar' })
    expect(parametrosDe({ tareas: 'borrar' }, visibles)).toEqual({ proyectos: 'conservar', tareas: 'borrar' })
  })

  it('nunca manda filas ocultas, aunque tengan una elección guardada', () => {
    const visibles = categoriasVisibles(impacto, CATEGORIAS)
    expect(parametrosDe({ ideas: 'borrar', subobjetivos: 'borrar' }, visibles)).toEqual({ proyectos: 'conservar', tareas: 'conservar' })
  })

  it('sin filas visibles no hay parámetros', () => {
    expect(parametrosDe({ ideas: 'borrar' }, [])).toEqual({})
  })

  it('normaliza las elecciones: una por categoría, siempre explícitas', () => {
    expect(eleccionesNormalizadas({ tareas: 'borrar' }, CATEGORIAS)).toEqual({
      subobjetivos: 'conservar',
      proyectos: 'conservar',
      tareas: 'borrar',
      ideas: 'conservar',
    })
  })
})

describe('resumenBorrado', () => {
  it('si todo se mueve, solo se borra el elemento', () => {
    expect(partesBorradas(VACIO, CATEGORIAS)).toEqual([])
    expect(resumenBorrado('Salud', VACIO, CATEGORIAS)).toBe('Solo se borrará «Salud».')
  })

  it('nombra solo lo que se borra, con singular y plural', () => {
    const impacto: ImpactoBorrado = {
      ...VACIO,
      proyectos: { total: 3, borrados: 2, rescatados: 1 },
      tareas: { total: 4, borrados: 5 },
      ideas: { total: 2, borrados: 1 },
    }
    expect(resumenBorrado('Salud', impacto, CATEGORIAS)).toBe('Se borrarán «Salud», 2 proyectos, 5 tareas y 1 idea.')
  })

  it('con una sola categoría usa «y» después del nombre', () => {
    const impacto: ImpactoBorrado = { ...VACIO, tareas: { total: 1, borrados: 1 } }
    expect(resumenBorrado('Casa', impacto, CATEGORIAS)).toBe('Se borrarán «Casa» y 1 tarea.')
  })
})

describe('avisoRescatados', () => {
  const impacto = (rescatados: number): ImpactoBorrado => ({ ...VACIO, proyectos: { total: 3, borrados: 3 - rescatados, rescatados } })

  it('singular y plural', () => {
    expect(avisoRescatados(impacto(1), { proyectos: 'borrar' })).toBe('1 proyecto se salva por estar ligado a otro objetivo.')
    expect(avisoRescatados(impacto(2), { proyectos: 'borrar' })).toBe('2 proyectos se salvan por estar ligados a otro objetivo.')
  })

  it('sin rescatados o sin proyectos=borrar no avisa', () => {
    expect(avisoRescatados(impacto(0), { proyectos: 'borrar' })).toBeNull()
    expect(avisoRescatados(impacto(2), {})).toBeNull()
    expect(avisoRescatados(impacto(2), { proyectos: 'conservar' })).toBeNull()
  })
})

describe('textoFila', () => {
  it('Mover describe adónde van', () => {
    expect(textoFila(PROYECTOS, VACIO, 'conservar')).toBe('Quedan sin objetivo')
    expect(textoFila(TAREAS, VACIO, 'conservar')).toBe('Quedan sueltas')
  })

  it('Borrar describe lo que realmente desaparece', () => {
    const impacto: ImpactoBorrado = { ...VACIO, tareas: { total: 2, borrados: 2 }, ideas: { total: 1, borrados: 1 } }
    expect(textoFila(TAREAS, impacto, 'borrar')).toBe('Se borran 2 tareas')
    expect(textoFila(IDEAS, impacto, 'borrar')).toBe('Se borra 1 idea')
  })

  it('aclara «incluye» solo si borrados supera al total', () => {
    const impacto: ImpactoBorrado = { ...VACIO, tareas: { total: 2, borrados: 5 }, proyectos: { total: 1, borrados: 3, rescatados: 0 } }
    expect(textoFila(TAREAS, impacto, 'borrar')).toBe('Se borran 5 tareas (incluye subtareas)')
    expect(textoFila(PROYECTOS, impacto, 'borrar')).toBe('Se borran 3 proyectos (incluye subproyectos)')
  })

  it('las ideas nunca llevan «incluye»', () => {
    const impacto: ImpactoBorrado = { ...VACIO, ideas: { total: 1, borrados: 4 } }
    expect(textoFila(IDEAS, impacto, 'borrar')).toBe('Se borran 4 ideas')
  })

  it('si no desaparece nada (todos rescatados) lo dice', () => {
    const impacto: ImpactoBorrado = { ...VACIO, proyectos: { total: 2, borrados: 0, rescatados: 2 } }
    expect(textoFila(PROYECTOS, impacto, 'borrar')).toBe('No se borra ninguno')
  })
})
