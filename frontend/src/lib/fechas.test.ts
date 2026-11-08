import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aFechaLocal,
  aIsoConDesfase,
  ahora,
  formatearDesfase,
  formatearFechaHoraCorta,
  formatearFechaLarga,
  formatearHora,
  formatearMinutos,
  hoy,
  mensajeGuardada,
  minutosDeHora,
  minutosDelDia,
  rangoDelDia,
  recortarEventoAlDia,
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

describe('minutos del día', () => {
  it('minutosDeHora y formatearMinutos son inversas', () => {
    expect(minutosDeHora('09:30:00')).toBe(570)
    expect(minutosDeHora('00:00')).toBe(0)
    expect(formatearMinutos(570)).toBe('09:30')
    expect(formatearMinutos(1440)).toBe('24:00')
  })

  it('aFechaLocal usa el día local, no el de UTC', () => {
    // 23:30 en Buenos Aires = 02:30 UTC del día siguiente.
    expect(aFechaLocal(new Date('2026-11-10T23:30:00-03:00'))).toBe('2026-11-10')
  })

  it('minutosDelDia cuenta desde la medianoche local', () => {
    expect(minutosDelDia(new Date('2026-11-10T14:05:00-03:00'), '2026-11-10')).toBe(845)
  })

  it('formatearFechaHoraCorta escribe día y hora locales', () => {
    expect(formatearFechaHoraCorta('2026-11-10T15:00:00-03:00')).toBe('mar 10 nov · 15:00')
  })
})

describe('recortarEventoAlDia', () => {
  const dia = '2026-11-10'

  it('deja intacto un evento dentro del día', () => {
    const e = { fechaHoraInicio: '2026-11-10T15:00:00-03:00', fechaHoraFin: '2026-11-10T16:30:00-03:00' }
    expect(recortarEventoAlDia(e, dia)).toEqual({ inicioMin: 900, finMin: 990 })
  })

  it('recorta al inicio del día un evento que viene del día anterior', () => {
    const e = { fechaHoraInicio: '2026-11-09T22:00:00-03:00', fechaHoraFin: '2026-11-10T01:30:00-03:00' }
    expect(recortarEventoAlDia(e, dia)).toEqual({ inicioMin: 0, finMin: 90 })
  })

  it('recorta al fin del día un evento que sigue al día siguiente', () => {
    const e = { fechaHoraInicio: '2026-11-10T22:00:00-03:00', fechaHoraFin: '2026-11-11T02:00:00-03:00' }
    expect(recortarEventoAlDia(e, dia)).toEqual({ inicioMin: 1320, finMin: 1440 })
  })

  it('un evento de varios días ocupa el día entero', () => {
    const e = { fechaHoraInicio: '2026-11-08T10:00:00-03:00', fechaHoraFin: '2026-11-12T10:00:00-03:00' }
    expect(recortarEventoAlDia(e, dia)).toEqual({ inicioMin: 0, finMin: 1440 })
  })

  it('devuelve null si el evento no toca el día (los bordes exactos no cuentan)', () => {
    const antes = { fechaHoraInicio: '2026-11-09T22:00:00-03:00', fechaHoraFin: '2026-11-10T00:00:00-03:00' }
    const despues = { fechaHoraInicio: '2026-11-11T00:00:00-03:00', fechaHoraFin: '2026-11-11T01:00:00-03:00' }
    expect(recortarEventoAlDia(antes, dia)).toBeNull()
    expect(recortarEventoAlDia(despues, dia)).toBeNull()
  })

  it('interpreta el instante aunque el desfase del evento sea otro', () => {
    // 18:00 UTC = 15:00 en Buenos Aires.
    const e = { fechaHoraInicio: '2026-11-10T18:00:00+00:00', fechaHoraFin: '2026-11-10T19:00:00+00:00' }
    expect(recortarEventoAlDia(e, dia)).toEqual({ inicioMin: 900, finMin: 960 })
  })
})

describe('mensajeGuardada', () => {
  it('sin fecha dice que va al cofre', () => {
    expect(mensajeGuardada(null)).toBe('Guardada en el cofre')
  })
  it('con fecha la escribe en español', () => {
    expect(mensajeGuardada('2026-11-12')).toBe('Guardada para el 12 de noviembre')
    expect(mensajeGuardada('2026-12-01')).toBe('Guardada para el 1 de diciembre')
  })
})
