import { describe, expect, it } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import {
  DURACION_POR_DEFECTO_MIN,
  armarBloques,
  calcularRango,
  distribuirSolapes,
  finDeTarea,
  posicionBloque,
  type Bloque,
} from './horario'

function bloque(clave: string, inicioMin: number, finMin: number): Bloque {
  return { clave, tipo: 'tarea', titulo: clave, inicioMin, finMin, prioridad: null }
}

const h = (horas: number, minutos = 0) => horas * 60 + minutos

describe('calcularRango', () => {
  it('usa 08-21 sin bloques o con bloques dentro', () => {
    expect(calcularRango([])).toEqual({ inicioHora: 8, finHora: 21 })
    expect(calcularRango([{ inicioMin: h(9), finMin: h(10) }])).toEqual({ inicioHora: 8, finHora: 21 })
  })

  it('se amplía hacia arriba y hacia abajo a horas enteras', () => {
    expect(calcularRango([{ inicioMin: h(6, 30), finMin: h(7) }])).toEqual({ inicioHora: 6, finHora: 21 })
    expect(calcularRango([{ inicioMin: h(20), finMin: h(22, 15) }])).toEqual({ inicioHora: 8, finHora: 23 })
  })

  it('llega a 24 con un bloque que termina a medianoche', () => {
    expect(calcularRango([{ inicioMin: h(22), finMin: 1440 }])).toEqual({ inicioHora: 8, finHora: 24 })
  })
})

describe('posicionBloque', () => {
  const rango = { inicioHora: 8, finHora: 21 }

  it('56 px por hora desde el inicio del rango', () => {
    expect(posicionBloque(h(8), h(9), rango)).toEqual({ top: 0, height: 56 })
    expect(posicionBloque(h(9, 30), h(11), rango)).toEqual({ top: 84, height: 84 })
  })

  it('respeta un rango ampliado', () => {
    expect(posicionBloque(h(6), h(7), { inicioHora: 6, finHora: 21 }).top).toBe(0)
  })

  it('un bloque muy corto mide al menos lo de media hora', () => {
    expect(posicionBloque(h(9), h(9, 10), rango).height).toBe(28)
  })
})

describe('distribuirSolapes', () => {
  const columnas = (bloques: Bloque[]) =>
    Object.fromEntries(distribuirSolapes(bloques).map((b) => [b.clave, [b.columna, b.totalColumnas]]))

  it('sin solapes: una sola columna', () => {
    expect(columnas([bloque('a', h(9), h(10)), bloque('b', h(11), h(12))])).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('los bordes exactos no se consideran choque', () => {
    expect(columnas([bloque('a', h(9), h(10)), bloque('b', h(10), h(11))])).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('dos solapados van lado a lado', () => {
    expect(columnas([bloque('a', h(9), h(11)), bloque('b', h(10), h(12))])).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('tres a la vez usan tres columnas', () => {
    const c = columnas([bloque('a', h(9), h(12)), bloque('b', h(10), h(12)), bloque('c', h(11), h(12))])
    expect(c).toEqual({ a: [0, 3], b: [1, 3], c: [2, 3] })
  })

  it('encadenados (A–B, B–C sin A–C) comparten grupo pero reutilizan la columna libre', () => {
    const c = columnas([bloque('a', h(9), h(10)), bloque('b', h(9, 30), h(11)), bloque('c', h(10, 30), h(12))])
    expect(c).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] })
  })

  it('un grupo no afecta a otro posterior', () => {
    const c = columnas([bloque('a', h(9), h(11)), bloque('b', h(10), h(12)), bloque('c', h(14), h(15))])
    expect(c.c).toEqual([0, 1])
  })

  it('un bloque corto cuenta como mínimo media hora, que es lo que se dibuja', () => {
    expect(columnas([bloque('a', h(9), h(9, 10)), bloque('b', h(9, 20), h(10))])).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('no depende del orden de entrada ni modifica la lista original', () => {
    const entrada = [bloque('b', h(10), h(12)), bloque('a', h(9), h(11))]
    expect(columnas(entrada)).toEqual({ a: [0, 2], b: [1, 2] })
    expect(entrada.map((b) => b.clave)).toEqual(['b', 'a'])
  })

  it('conserva los campos propios de cada elemento (es genérica)', () => {
    const propios = [
      { inicioMin: h(9), finMin: h(11), nombre: 'uno', extra: { id: 1 } },
      { inicioMin: h(10), finMin: h(12), nombre: 'dos', extra: { id: 2 } },
    ]
    const colocados = distribuirSolapes(propios)
    expect(colocados.map((c) => [c.nombre, c.extra.id, c.columna, c.totalColumnas])).toEqual([
      ['uno', 1, 0, 2],
      ['dos', 2, 1, 2],
    ])
  })
})

describe('finDeTarea', () => {
  it('usa la hora de fin si es posterior al inicio', () => {
    expect(finDeTarea('09:00:00', '10:15:00')).toBe(h(10, 15))
  })

  it('sin hora de fin: duración por defecto (30 min)', () => {
    expect(DURACION_POR_DEFECTO_MIN).toBe(30)
    expect(finDeTarea('09:00:00', null)).toBe(h(9, 30))
  })

  it('una hora de fin no posterior al inicio también usa la duración por defecto', () => {
    expect(finDeTarea('09:00:00', '09:00:00')).toBe(h(9, 30))
  })

  it('no pasa de la medianoche', () => {
    expect(finDeTarea('23:50:00', null)).toBe(1440)
  })
})

describe('armarBloques', () => {
  const tarea = (parcial: Partial<Tarea>): Tarea => ({
    id: 1, titulo: 'T', descripcion: null, estado: 'PENDIENTE', prioridad: null, fecha: '2026-11-10',
    horaInicio: '09:00:00', horaFin: null, padreId: null, proyectoId: null, objetivoId: null,
    vecesPospuesta: 0, fechaCreacion: '2026-11-01T10:00:00-03:00', ...parcial,
  })
  const evento = (parcial: Partial<Evento>): Evento => ({
    id: 5, titulo: 'E', descripcion: null, fechaHoraInicio: '2026-11-10T15:00:00-03:00',
    fechaHoraFin: '2026-11-10T16:00:00-03:00', prioridad: null, ...parcial,
  })

  it('convierte tareas y eventos en bloques y recorta los eventos al día', () => {
    const bloques = armarBloques(
      [tarea({ id: 1, horaFin: '10:00:00' }), tarea({ id: 2, horaInicio: null })],
      [evento({ id: 5 }), evento({ id: 6, fechaHoraInicio: '2026-11-10T22:00:00-03:00', fechaHoraFin: '2026-11-11T03:00:00-03:00' })],
      '2026-11-10',
    )
    expect(bloques.map((b) => [b.clave, b.inicioMin, b.finMin])).toEqual([
      ['tarea-1', 540, 600],
      ['evento-5', 900, 960],
      ['evento-6', 1320, 1440],
    ])
  })

  it('descarta eventos que no tocan el día', () => {
    const fuera = evento({ fechaHoraInicio: '2026-11-11T09:00:00-03:00', fechaHoraFin: '2026-11-11T10:00:00-03:00' })
    expect(armarBloques([], [fuera], '2026-11-10')).toEqual([])
  })
})
