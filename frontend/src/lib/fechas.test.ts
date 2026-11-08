import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aIsoConDesfase,
  ahora,
  formatearDesfase,
  formatearFechaLarga,
  formatearHora,
  hoy,
  rangoDelDia,
} from './fechas'

afterEach(() => vi.useRealTimers())

describe('formatearDesfase', () => {
  it('formatea un desfase negativo', () => {
    expect(formatearDesfase(-180)).toBe('-03:00')
  })

  it('formatea un desfase positivo', () => {
    expect(formatearDesfase(60)).toBe('+01:00')
  })

  it('formatea cero como +00:00', () => {
    expect(formatearDesfase(0)).toBe('+00:00')
  })

  it('conserva los minutos de desfases no enteros', () => {
    expect(formatearDesfase(330)).toBe('+05:30')
    expect(formatearDesfase(-210)).toBe('-03:30')
  })
})

describe('formato para mostrar', () => {
  it('formatearFechaLarga escribe el día en español', () => {
    expect(formatearFechaLarga('2026-11-10')).toBe('martes, 10 de noviembre de 2026')
  })

  it('formatearHora quita los segundos', () => {
    expect(formatearHora('09:30:00')).toBe('09:30')
  })
})

// vitest.config.ts fija TZ = America/Argentina/Buenos_Aires (UTC-3, sin horario de verano).
describe('con zona horaria de Buenos Aires', () => {
  it('la zona de los tests es la esperada', () => {
    expect(new Date(2026, 10, 10).getTimezoneOffset()).toBe(180)
  })

  it('aIsoConDesfase usa la hora local con desfase, no UTC', () => {
    expect(aIsoConDesfase(new Date(2026, 10, 10, 15, 0, 0))).toBe('2026-11-10T15:00:00-03:00')
  })

  it('hoy() es el día local aunque en UTC ya sea el día siguiente', () => {
    // 22:30 del 10/11 en Buenos Aires = 01:30 del 11/11 en UTC.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-11T01:30:00Z'))
    expect(hoy()).toBe('2026-11-10')
    expect(ahora()).toBe('2026-11-10T22:30:00-03:00')
  })

  it('rangoDelDia va de 00:00 a 00:00 del día siguiente', () => {
    expect(rangoDelDia('2026-11-10')).toEqual({
      desde: '2026-11-10T00:00:00-03:00',
      hasta: '2026-11-11T00:00:00-03:00',
    })
  })

  it('rangoDelDia cruza fin de mes y de año', () => {
    expect(rangoDelDia('2026-11-30').hasta).toBe('2026-12-01T00:00:00-03:00')
    expect(rangoDelDia('2026-12-31').hasta).toBe('2027-01-01T00:00:00-03:00')
  })

  it('rangoDelDia sin argumento usa hoy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T15:00:00Z'))
    expect(rangoDelDia().desde).toBe('2026-11-10T00:00:00-03:00')
  })
})
