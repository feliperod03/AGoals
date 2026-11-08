import { describe, expect, it } from 'vitest'

import type { Recordatorio } from '@/types/recordatorio'
import { proximosRecordatorios, tituloRecordatorio } from './proximos'

function rec(parcial: Partial<Recordatorio>): Recordatorio {
  return { id: 1, tareaId: null, eventoId: null, fechaHora: '2026-11-10T15:00:00-03:00', enviado: false, descripcion: '', ...parcial }
}

const AHORA = new Date('2026-11-10T12:00:00-03:00')

describe('proximosRecordatorios', () => {
  it('descarta enviados y pasados, ordena por fecha y deja los 3 primeros', () => {
    const lista = [
      rec({ id: 1, fechaHora: '2026-11-12T10:00:00-03:00' }),
      rec({ id: 2, fechaHora: '2026-11-10T09:00:00-03:00' }), // pasado
      rec({ id: 3, fechaHora: '2026-11-10T13:00:00-03:00', enviado: true }),
      rec({ id: 4, fechaHora: '2026-11-10T14:00:00-03:00' }),
      rec({ id: 5, fechaHora: '2026-11-11T08:00:00-03:00' }),
      rec({ id: 6, fechaHora: '2026-11-20T08:00:00-03:00' }),
    ]
    expect(proximosRecordatorios(lista, AHORA).map((r) => r.id)).toEqual([4, 5, 1])
  })

  it('compara instantes, no texto (desfases distintos)', () => {
    // 14:30 UTC = 11:30 en Buenos Aires: ya pasó aunque el texto "14:30" sea mayor que "12:00".
    const pasado = rec({ id: 1, fechaHora: '2026-11-10T14:30:00+00:00' })
    const futuro = rec({ id: 2, fechaHora: '2026-11-10T16:00:00+00:00' })
    expect(proximosRecordatorios([pasado, futuro], AHORA).map((r) => r.id)).toEqual([2])
  })

  it('el que está justo en este instante sí entra', () => {
    expect(proximosRecordatorios([rec({ fechaHora: '2026-11-10T12:00:00-03:00' })], AHORA)).toHaveLength(1)
  })

  it('lista vacía', () => {
    expect(proximosRecordatorios([], AHORA)).toEqual([])
  })
})

describe('tituloRecordatorio', () => {
  it('prefiere la descripción', () => {
    expect(tituloRecordatorio(rec({ descripcion: 'Llamar', tareaId: 3 }), 'Otra cosa')).toBe('Llamar')
  })

  it('sin descripción usa el título de la tarea o evento consultado', () => {
    expect(tituloRecordatorio(rec({ tareaId: 3 }), 'Pagar la luz')).toBe('Pagar la luz')
  })

  it('sin título consultado usa un texto genérico', () => {
    expect(tituloRecordatorio(rec({ tareaId: 3 }))).toBe('Recordatorio de una tarea')
    expect(tituloRecordatorio(rec({ eventoId: 3 }))).toBe('Recordatorio de un evento')
    expect(tituloRecordatorio(rec({ descripcion: '  ' }))).toBe('Recordatorio')
  })
})
