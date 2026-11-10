import { describe, expect, it } from 'vitest'

import {
  mensajeBorrado,
  mensajeCreado,
  mensajeEstadoCambiado,
  mensajeGuardado,
  mensajeProyectoDesvinculado,
  mensajeProyectoVinculado,
} from './mensajes'

describe('mensajes de proyectos y objetivos', () => {
  it('vincular y quitar un proyecto de un objetivo nombran a ambos', () => {
    expect(mensajeProyectoVinculado('Plan', 'Salud')).toBe('«Plan» ahora es parte de «Salud»')
    expect(mensajeProyectoDesvinculado('Plan', 'Salud')).toBe('«Plan» ya no pertenece a «Salud»')
  })

  it('creado, guardado y borrado nombran el elemento', () => {
    expect(mensajeCreado('Proyecto', 'Mudanza')).toBe('Proyecto «Mudanza» creado')
    expect(mensajeCreado('Objetivo', 'Salud')).toBe('Objetivo «Salud» creado')
    expect(mensajeGuardado('Mudanza')).toBe('«Mudanza» guardado')
    expect(mensajeBorrado('Mudanza')).toBe('«Mudanza» borrado')
    expect(mensajeBorrado('Salud', ['2 proyectos', '5 tareas'])).toBe('«Salud» borrado; también 2 proyectos y 5 tareas')
    expect(mensajeBorrado('Salud', ['1 idea'])).toBe('«Salud» borrado; también 1 idea')
  })

  it('el cambio de estado, si sigue visible con el filtro, no agrega nada', () => {
    expect(mensajeEstadoCambiado('Mudanza', 'EN_PROGRESO', 'abiertos')).toBe('«Mudanza» pasó a En progreso')
    expect(mensajeEstadoCambiado('Mudanza', 'HECHO', 'todos')).toBe('«Mudanza» pasó a Hecho')
    expect(mensajeEstadoCambiado('Mudanza', 'HECHO', 'HECHO')).toBe('«Mudanza» pasó a Hecho')
  })

  it('si el nuevo estado queda fuera del filtro, avisa que la fila ya no se ve', () => {
    expect(mensajeEstadoCambiado('Mudanza', 'HECHO', 'abiertos')).toBe('«Mudanza» pasó a Hecho; ya no se ve con el filtro actual')
    expect(mensajeEstadoCambiado('Mudanza', 'CANCELADO', 'abiertos')).toBe('«Mudanza» pasó a Cancelado; ya no se ve con el filtro actual')
    expect(mensajeEstadoCambiado('Mudanza', 'PENDIENTE', 'EN_PAUSA')).toBe('«Mudanza» pasó a Pendiente; ya no se ve con el filtro actual')
  })
})
