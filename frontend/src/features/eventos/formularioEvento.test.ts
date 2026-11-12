import { describe, expect, it } from 'vitest'

import type { Evento } from '@/types/evento'
import {
  aRequestEvento,
  alternarTodoElDia,
  esDeVariosDias,
  esTodoElDia,
  inicioIso,
  moverFinConservandoDuracion,
  valoresIniciales,
  valoresParaHueco,
  valoresParaNuevo,
  valoresTodoElDia,
  type ValoresEvento,
} from './formularioEvento'

const evento = (inicio: string, fin: string, extra: Partial<Evento> = {}): Evento => ({
  id: 1,
  titulo: 'Dentista',
  descripcion: '',
  fechaHoraInicio: inicio,
  fechaHoraFin: fin,
  prioridad: null,
  ...extra,
})

const valores = (extra: Partial<ValoresEvento> = {}): ValoresEvento => ({
  titulo: 'Dentista',
  descripcion: '',
  prioridad: '',
  todoElDia: false,
  fechaInicio: '2026-12-15',
  horaInicio: '09:00',
  fechaFin: '2026-12-15',
  horaFin: '10:00',
  ...extra,
})

const lapso = (v: ValoresEvento) => ({ fechaInicio: v.fechaInicio, horaInicio: v.horaInicio, fechaFin: v.fechaFin, horaFin: v.horaFin })

describe('valoresParaNuevo', () => {
  const hoy = '2026-11-10'

  it('otro día: 09:00–10:00, sin título ni prioridad', () => {
    expect(valoresParaNuevo('2026-12-15', hoy, new Date('2026-11-10T14:20:00-03:00'))).toEqual(valores({ titulo: '' }))
  })

  it('hoy: empieza en la hora en punto posterior a ahora y dura 1 h', () => {
    expect(lapso(valoresParaNuevo(hoy, hoy, new Date('2026-11-10T14:20:00-03:00')))).toEqual({
      fechaInicio: hoy,
      horaInicio: '15:00',
      fechaFin: hoy,
      horaFin: '16:00',
    })
  })

  it('hoy a las 14:00 justas: 15:00', () => {
    expect(valoresParaNuevo(hoy, hoy, new Date('2026-11-10T14:00:00-03:00')).horaInicio).toBe('15:00')
  })

  it('hoy a las 22:30: 23:00–00:00 del día siguiente', () => {
    expect(lapso(valoresParaNuevo(hoy, hoy, new Date('2026-11-10T22:30:00-03:00')))).toEqual({
      fechaInicio: hoy,
      horaInicio: '23:00',
      fechaFin: '2026-11-11',
      horaFin: '00:00',
    })
  })

  it('hoy de 23:00 a 23:59: 23:00–00:00 del día siguiente (no hay otra hora en punto en el día)', () => {
    for (const hora of ['23:00', '23:10', '23:59']) {
      expect(lapso(valoresParaNuevo(hoy, hoy, new Date(`2026-11-10T${hora}:00-03:00`)))).toEqual({
        fechaInicio: hoy,
        horaInicio: '23:00',
        fechaFin: '2026-11-11',
        horaFin: '00:00',
      })
    }
  })
})

describe('valoresParaHueco y valoresTodoElDia', () => {
  it('10:00 → 10:00–11:00 del mismo día', () => {
    expect(lapso(valoresParaHueco('2026-12-15', 600))).toEqual({ fechaInicio: '2026-12-15', horaInicio: '10:00', fechaFin: '2026-12-15', horaFin: '11:00' })
  })

  it.each([
    [1380, '23:00'],
    [1410, '23:30'],
  ])('%i min → empieza a las %s y termina a las 00:00 del día siguiente', (minutos, hora) => {
    expect(lapso(valoresParaHueco('2026-12-31', minutos))).toEqual({ fechaInicio: '2026-12-31', horaInicio: hora, fechaFin: '2027-01-01', horaFin: '00:00' })
  })

  it('valoresTodoElDia marca la casilla con el mismo día como primero y último', () => {
    const v = valoresTodoElDia('2026-12-08')
    expect(v.todoElDia).toBe(true)
    expect(v.fechaInicio).toBe('2026-12-08')
    expect(v.fechaFin).toBe('2026-12-08')
  })
})

describe('valoresIniciales, esTodoElDia y esDeVariosDias', () => {
  it('evento normal en hora local', () => {
    const e = evento('2026-12-15T09:00:00-03:00', '2026-12-15T10:30:00-03:00', { descripcion: 'Llevar estudios', prioridad: 'MEDIA' })
    expect(valoresIniciales(e)).toEqual(valores({ descripcion: 'Llevar estudios', prioridad: 'MEDIA', horaFin: '10:30' }))
    expect(esTodoElDia(e)).toBe(false)
    expect(esDeVariosDias(e)).toBe(false)
  })

  it('descripción null queda vacía', () => {
    expect(valoresIniciales(evento('2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00', { descripcion: null })).descripcion).toBe('')
  })

  it('cruza la medianoche: fin al día siguiente; es de varios días', () => {
    const e = evento('2026-12-09T22:00:00-03:00', '2026-12-10T02:00:00-03:00')
    expect(lapso(valoresIniciales(e))).toEqual({ fechaInicio: '2026-12-09', horaInicio: '22:00', fechaFin: '2026-12-10', horaFin: '02:00' })
    expect(esDeVariosDias(e)).toBe(true)
  })

  it('termina a las 00:00 del día siguiente: no es de varios días ni de todo el día', () => {
    const e = evento('2026-12-15T22:00:00-03:00', '2026-12-16T00:00:00-03:00')
    expect(lapso(valoresIniciales(e))).toEqual({ fechaInicio: '2026-12-15', horaInicio: '22:00', fechaFin: '2026-12-16', horaFin: '00:00' })
    expect(esDeVariosDias(e)).toBe(false)
    expect(esTodoElDia(e)).toBe(false)
  })

  it('de 00:00 a 00:00 del día siguiente: todo el día, primer = último día', () => {
    const e = evento('2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00')
    const v = valoresIniciales(e)
    expect(v.todoElDia).toBe(true)
    expect(v.fechaInicio).toBe('2026-12-08')
    expect(v.fechaFin).toBe('2026-12-08')
    expect(esDeVariosDias(e)).toBe(false)
  })

  it('tres días completos: el último día es inclusivo', () => {
    const e = evento('2026-12-02T00:00:00-03:00', '2026-12-05T00:00:00-03:00')
    const v = valoresIniciales(e)
    expect(v.todoElDia).toBe(true)
    expect(v.fechaFin).toBe('2026-12-04')
    expect(esDeVariosDias(e)).toBe(true)
  })

  it('varios días con horas no es todo el día', () => {
    const e = evento('2026-12-02T09:00:00-03:00', '2026-12-04T18:00:00-03:00')
    expect(esTodoElDia(e)).toBe(false)
    expect(valoresIniciales(e).todoElDia).toBe(false)
  })

  it('decide la hora local, no el desfase con el que llegó el ISO', () => {
    expect(esTodoElDia(evento('2026-12-08T03:00:00Z', '2026-12-09T03:00:00Z'))).toBe(true)
    expect(esTodoElDia(evento('2026-12-08T00:00:00Z', '2026-12-09T00:00:00Z'))).toBe(false)
  })
})

describe('alternarTodoElDia', () => {
  it('marcar con fin el mismo día: último día = ese día', () => {
    expect(alternarTodoElDia(valores(), true)).toEqual(valores({ todoElDia: true }))
  })

  it('marcar con fin a las 00:00: el último día es el anterior', () => {
    const v = alternarTodoElDia(valores({ horaInicio: '22:00', fechaFin: '2026-12-16', horaFin: '00:00' }), true)
    expect(v.fechaFin).toBe('2026-12-15')
  })

  it('marcar con fin a las 18:00 dos días después: ese día', () => {
    expect(alternarTodoElDia(valores({ fechaFin: '2026-12-17', horaFin: '18:00' }), true).fechaFin).toBe('2026-12-17')
  })

  it('marcar con un fin anterior al inicio (o vacío): último día = primero', () => {
    expect(alternarTodoElDia(valores({ fechaFin: '2026-12-10' }), true).fechaFin).toBe('2026-12-15')
    expect(alternarTodoElDia(valores({ fechaFin: '' }), true).fechaFin).toBe('2026-12-15')
  })

  it('desmarcar recupera las horas', () => {
    expect(alternarTodoElDia(valores({ todoElDia: true }), false)).toEqual(valores())
  })

  it('marcar y desmarcar un evento que termina a la medianoche lo deja igual', () => {
    const original = valores({ horaInicio: '22:00', fechaFin: '2026-12-16', horaFin: '00:00' })
    expect(alternarTodoElDia(alternarTodoElDia(original, true), false)).toEqual(original)
  })

  it('desmarcar un evento de todo el día de un solo día: 09:00–10:00', () => {
    const v = valoresIniciales(evento('2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00'))
    expect(lapso(alternarTodoElDia(v, false))).toEqual({ fechaInicio: '2026-12-08', horaInicio: '09:00', fechaFin: '2026-12-08', horaFin: '10:00' })
  })

  it('desmarcar con horas que dejarían el fin antes del inicio: dura 1 h', () => {
    const v = alternarTodoElDia(valores({ todoElDia: true, horaInicio: '15:00', horaFin: '10:00' }), false)
    expect(lapso(v)).toEqual({ fechaInicio: '2026-12-15', horaInicio: '15:00', fechaFin: '2026-12-15', horaFin: '16:00' })
  })

  it('sin cambio de estado devuelve lo mismo', () => {
    const v = valores()
    expect(alternarTodoElDia(v, false)).toBe(v)
  })
})

describe('moverFinConservandoDuracion', () => {
  it('cambiar el día de inicio corre el fin el mismo tiempo', () => {
    expect(moverFinConservandoDuracion(valores(), valores({ fechaInicio: '2026-12-17' }))).toEqual({ fechaFin: '2026-12-17', horaFin: '10:00' })
  })

  it('cambiar la hora de inicio corre la hora de fin', () => {
    expect(moverFinConservandoDuracion(valores(), valores({ horaInicio: '11:30' }))).toEqual({ fechaFin: '2026-12-15', horaFin: '12:30' })
  })

  it('una duración que cruza la medianoche se conserva', () => {
    const antes = valores({ horaInicio: '22:00', fechaFin: '2026-12-16', horaFin: '02:00' })
    expect(moverFinConservandoDuracion(antes, { ...antes, horaInicio: '23:00' })).toEqual({ fechaFin: '2026-12-16', horaFin: '03:00' })
  })

  it('con todo el día conserva la cantidad de días', () => {
    const antes = valores({ todoElDia: true, fechaInicio: '2026-12-02', fechaFin: '2026-12-04' })
    expect(moverFinConservandoDuracion(antes, { ...antes, fechaInicio: '2026-12-10' })).toEqual({ fechaFin: '2026-12-12', horaFin: '10:00' })
  })

  it('sin duración válida no toca el fin', () => {
    expect(moverFinConservandoDuracion(valores({ horaFin: '' }), valores({ horaInicio: '11:00', horaFin: '' }))).toBeNull()
    expect(moverFinConservandoDuracion(valores({ horaFin: '08:00' }), valores({ horaInicio: '11:00' }))).toBeNull()
    expect(moverFinConservandoDuracion(valores(), valores({ fechaInicio: '' }))).toBeNull()
  })
})

describe('inicioIso', () => {
  it('con hora: día y hora de inicio', () => {
    expect(inicioIso(valores({ horaInicio: '15:30' }))).toBe('2026-12-15T15:30:00-03:00')
  })

  it('todo el día: 00:00 del primer día (la hora oculta no cuenta)', () => {
    expect(inicioIso(valores({ todoElDia: true, horaInicio: '15:30' }))).toBe('2026-12-15T00:00:00-03:00')
  })

  it.each([
    ['sin hora', { horaInicio: '' }],
    ['sin día', { fechaInicio: '' }],
    ['todo el día sin día', { todoElDia: true, fechaInicio: '' }],
  ])('%s → null', (_, extra) => {
    expect(inicioIso(valores(extra))).toBeNull()
  })

  it('coincide con el inicio del cuerpo del PUT', () => {
    for (const v of [valores(), valores({ todoElDia: true, fechaFin: '2026-12-17' })]) {
      const r = aRequestEvento(v)
      expect(r.ok && r.request.fechaHoraInicio).toBe(inicioIso(v))
    }
  })
})

describe('aRequestEvento', () => {
  it('arma el cuerpo exacto con los cinco campos (recorta y pasa null)', () => {
    expect(aRequestEvento(valores({ titulo: '  Dentista  ', descripcion: '  Llevar estudios ' }))).toEqual({
      ok: true,
      request: {
        titulo: 'Dentista',
        descripcion: 'Llevar estudios',
        fechaHoraInicio: '2026-12-15T09:00:00-03:00',
        fechaHoraFin: '2026-12-15T10:00:00-03:00',
        prioridad: null,
      },
    })
  })

  it('descripción vacía va como "" y la prioridad elegida tal cual', () => {
    const r = aRequestEvento(valores({ descripcion: '   ', prioridad: 'ALTA' }))
    expect(r.ok && r.request.descripcion).toBe('')
    expect(r.ok && r.request.prioridad).toBe('ALTA')
  })

  it('un fin a la medianoche se manda como 00:00 del día siguiente', () => {
    const r = aRequestEvento(valores({ horaInicio: '22:00', fechaFin: '2026-12-16', horaFin: '00:00' }))
    expect(r.ok && r.request.fechaHoraFin).toBe('2026-12-16T00:00:00-03:00')
  })

  it('todo el día: 00:00 del primer día a 00:00 del día siguiente al último', () => {
    const r = aRequestEvento(valores({ todoElDia: true, fechaInicio: '2026-12-02', fechaFin: '2026-12-04' }))
    expect(r.ok && r.request.fechaHoraInicio).toBe('2026-12-02T00:00:00-03:00')
    expect(r.ok && r.request.fechaHoraFin).toBe('2026-12-05T00:00:00-03:00')
  })

  it.each([
    ['', 'El título es obligatorio'],
    ['    ', 'El título es obligatorio'],
    ['a'.repeat(201), 'El título admite como máximo 200 caracteres'],
  ])('título %j → error', (titulo, error) => {
    expect(aRequestEvento(valores({ titulo }))).toEqual({ ok: false, errores: { titulo: error } })
  })

  it('200 caracteres (recortados) sí pasan', () => {
    expect(aRequestEvento(valores({ titulo: ` ${'a'.repeat(200)} ` })).ok).toBe(true)
  })

  it.each([
    ['fin igual al inicio', { horaFin: '09:00' }],
    ['fin anterior al inicio', { horaFin: '08:00' }],
    ['fin un día antes', { fechaFin: '2026-12-14', horaFin: '10:00' }],
  ])('%s → «El fin debe ser posterior al inicio»', (_, extra) => {
    expect(aRequestEvento(valores(extra))).toEqual({ ok: false, errores: { fin: 'El fin debe ser posterior al inicio' } })
  })

  it('todo el día con el último día antes del primero', () => {
    expect(aRequestEvento(valores({ todoElDia: true, fechaFin: '2026-12-14' }))).toEqual({
      ok: false,
      errores: { fin: 'El último día no puede ser anterior al primero' },
    })
  })

  it('fechas u horas vacías', () => {
    expect(aRequestEvento(valores({ horaInicio: '', fechaFin: '' }))).toEqual({
      ok: false,
      errores: { inicio: 'Indica el día y la hora de inicio', fin: 'Indica el día y la hora de fin' },
    })
    expect(aRequestEvento(valores({ todoElDia: true, fechaInicio: '' }))).toEqual({ ok: false, errores: { inicio: 'Indica el primer día' } })
    expect(aRequestEvento(valores({ todoElDia: true, fechaFin: '' }))).toEqual({ ok: false, errores: { fin: 'Indica el último día' } })
  })

  it('junta el error del título con los de fechas', () => {
    expect(aRequestEvento(valores({ titulo: '', horaFin: '08:00' }))).toEqual({
      ok: false,
      errores: { titulo: 'El título es obligatorio', fin: 'El fin debe ser posterior al inicio' },
    })
  })
})
