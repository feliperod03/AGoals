import { describe, expect, it } from 'vitest'

import type { Recordatorio } from '@/types/recordatorio'
import { instanteMovido } from './moverRecordatorio'

const recordatorio = (fechaHora: string, extra: Partial<Recordatorio> = {}): Recordatorio => ({
  id: 5,
  tareaId: null,
  eventoId: 9,
  fechaHora,
  canal: 'APP',
  enviado: false,
  descripcion: null,
  ...extra,
})

// Evento a las 15:00; el recordatorio, 60 min antes.
const INICIO = '2026-12-15T15:00:00-03:00'
const R = recordatorio('2026-12-15T14:00:00-03:00')

describe('instanteMovido', () => {
  it('adelanta el recordatorio lo mismo que el inicio (+30 min)', () => {
    expect(instanteMovido(R, INICIO, '2026-12-15T15:30:00-03:00')).toBe('2026-12-15T14:30:00-03:00')
  })

  it('lo atrasa lo mismo que el inicio (−2 h, cruzando de día)', () => {
    expect(instanteMovido(recordatorio('2026-12-15T00:30:00-03:00'), '2026-12-15T01:30:00-03:00', '2026-12-14T23:30:00-03:00')).toBe(
      '2026-12-14T22:30:00-03:00',
    )
  })

  it('conserva la distancia al mover el evento de día', () => {
    expect(instanteMovido(R, INICIO, '2026-12-17T15:00:00-03:00')).toBe('2026-12-17T14:00:00-03:00')
  })

  it('puede quedar en el pasado: lo devuelve igual', () => {
    expect(instanteMovido(R, INICIO, '2020-01-01T15:00:00-03:00')).toBe('2020-01-01T14:00:00-03:00')
  })

  it('mismo instante escrito con otro desfase → null', () => {
    expect(instanteMovido(R, INICIO, '2026-12-15T18:00:00Z')).toBeNull()
  })

  it('mismo inicio → null', () => {
    expect(instanteMovido(R, INICIO, INICIO)).toBeNull()
  })

  it('recordatorio enviado → null', () => {
    expect(instanteMovido(recordatorio(R.fechaHora, { enviado: true }), INICIO, '2026-12-15T16:00:00-03:00')).toBeNull()
  })

  it.each([
    ['inicio viejo', 'no es fecha', '2026-12-15T16:00:00-03:00'],
    ['inicio nuevo', INICIO, 'no es fecha'],
  ])('%s inválido → null', (_, viejo, nuevo) => {
    expect(instanteMovido(R, viejo, nuevo)).toBeNull()
  })

  it('recordatorio con fecha inválida → null', () => {
    expect(instanteMovido(recordatorio('nada'), INICIO, '2026-12-15T16:00:00-03:00')).toBeNull()
  })
})
