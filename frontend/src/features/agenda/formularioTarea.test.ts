import { describe, expect, it } from 'vitest'

import type { Tarea } from '@/types/tarea'
import { aRequest, puedeAgendarParaHoy, puedePosponer, requestConEstado, requestSinFecha, validarHoraFin, validarHoraInicio, valoresIniciales } from './formularioTarea'

const TAREA: Tarea = {
  id: 5,
  titulo: 'Informe',
  descripcion: 'Detalle',
  estado: 'HECHO',
  prioridad: 'ALTA',
  fecha: '2026-11-10',
  horaInicio: '09:30:00',
  horaFin: '10:30:00',
  padreId: 3,
  proyectoId: 8,
  objetivoId: null,
  vecesPospuesta: 2,
  fechaCreacion: '2026-11-01T10:00:00-03:00',
}

describe('aRequest', () => {
  it('crear con fecha y horas: no envía estado ni padreId', () => {
    expect(
      aRequest({ titulo: ' Pagar ', descripcion: '', prioridad: 'MEDIA', fecha: '2026-11-12', horaInicio: '08:00', horaFin: '09:00' }),
    ).toEqual({
      titulo: 'Pagar',
      descripcion: null,
      prioridad: 'MEDIA',
      fecha: '2026-11-12',
      horaInicio: '08:00',
      horaFin: '09:00',
    })
  })

  it('crear con fecha y sin horas', () => {
    expect(aRequest({ titulo: 'A', descripcion: 'x', prioridad: '', fecha: '2026-11-12', horaInicio: '', horaFin: '' })).toEqual({
      titulo: 'A',
      descripcion: 'x',
      prioridad: null,
      fecha: '2026-11-12',
      horaInicio: null,
      horaFin: null,
    })
  })

  it('sin fecha: todo vacío es null, aunque las horas vengan undefined (campos deshabilitados) o con valor', () => {
    const esperado = { titulo: 'A', descripcion: null, prioridad: null, fecha: null, horaInicio: null, horaFin: null }
    expect(aRequest({ titulo: 'A', descripcion: '', prioridad: '', fecha: '', horaInicio: undefined, horaFin: undefined })).toEqual(esperado)
    expect(aRequest({ titulo: 'A', fecha: '', horaInicio: '08:00', horaFin: '09:00' })).toEqual(esperado)
  })

  it('con fecha, una hora deshabilitada que llega undefined es null', () => {
    const r = aRequest({ titulo: 'A', fecha: '2026-11-12', horaInicio: '08:00', horaFin: undefined })
    expect(r.horaInicio).toBe('08:00')
    expect(r.horaFin).toBeNull()
  })

  it('editar reenvía estado y padreId originales', () => {
    const r = aRequest(valoresIniciales(TAREA), TAREA)
    expect(r).toEqual({
      titulo: 'Informe',
      descripcion: 'Detalle',
      estado: 'HECHO',
      prioridad: 'ALTA',
      fecha: '2026-11-10',
      horaInicio: '09:30',
      horaFin: '10:30',
      padreId: 3,
    })
  })

  it('editar: vaciar la fecha envía fecha y horas null, conservando estado y padreId', () => {
    const r = aRequest({ ...valoresIniciales(TAREA), fecha: '', horaInicio: undefined, horaFin: undefined }, TAREA)
    expect(r).toMatchObject({ fecha: null, horaInicio: null, horaFin: null, estado: 'HECHO', padreId: 3 })
  })
})

describe('valoresIniciales', () => {
  it('sin tarea, todo vacío', () => {
    expect(valoresIniciales()).toEqual({ titulo: '', descripcion: '', prioridad: '', fecha: '', horaInicio: '', horaFin: '' })
  })
  it('con tarea, HH:mm:ss pasa a HH:mm y los null a vacío', () => {
    const v = valoresIniciales({ ...TAREA, descripcion: null, prioridad: null, fecha: null, horaInicio: null, horaFin: null })
    expect(v).toMatchObject({ descripcion: '', prioridad: '', fecha: '', horaInicio: '', horaFin: '' })
    expect(valoresIniciales(TAREA)).toMatchObject({ horaInicio: '09:30', horaFin: '10:30' })
  })
})

describe('validaciones de horas', () => {
  it('fin sin inicio', () => {
    expect(validarHoraInicio('', '10:00')).toMatch(/inicio/)
    expect(validarHoraInicio('09:00', '10:00')).toBeUndefined()
    expect(validarHoraInicio('', '')).toBeUndefined()
  })
  it('fin debe ser posterior al inicio', () => {
    expect(validarHoraFin('10:00', '10:00')).toMatch(/posterior/)
    expect(validarHoraFin('10:00', '09:00')).toMatch(/posterior/)
    expect(validarHoraFin('10:00', '10:01')).toBeUndefined()
    expect(validarHoraFin('', '09:00')).toBeUndefined()
  })
})

describe('requestConEstado', () => {
  it('cambia solo el estado y conserva el resto de los campos', () => {
    const base = requestConEstado(TAREA, 'CANCELADO')
    expect(base.estado).toBe('CANCELADO')
    expect(base).toEqual({ ...aRequest(valoresIniciales(TAREA), TAREA), estado: 'CANCELADO' })
    expect(base.padreId).toBe(TAREA.padreId)
    expect(base.titulo).toBe('Informe')
    expect(base.prioridad).toBe('ALTA')
  })
})

describe('requestSinFecha', () => {
  it('pone fecha y horas en null y conserva el resto, incluidos estado y padreId', () => {
    expect(requestSinFecha({ ...TAREA, estado: 'EN_PROGRESO' })).toEqual({
      titulo: 'Informe',
      descripcion: 'Detalle',
      estado: 'EN_PROGRESO',
      prioridad: 'ALTA',
      fecha: null,
      horaInicio: null,
      horaFin: null,
      padreId: 3,
    })
  })
})

describe('puedePosponer', () => {
  it('solo tareas abiertas con fecha', () => {
    expect(puedePosponer({ ...TAREA, estado: 'PENDIENTE' })).toBe(true)
    expect(puedePosponer({ ...TAREA, estado: 'EN_PAUSA' })).toBe(true)
    expect(puedePosponer({ ...TAREA, estado: 'HECHO' })).toBe(false)
    expect(puedePosponer({ ...TAREA, estado: 'CANCELADO' })).toBe(false)
    expect(puedePosponer({ ...TAREA, estado: 'PENDIENTE', fecha: null })).toBe(false)
  })
})

describe('puedeAgendarParaHoy', () => {
  const hoy = '2026-11-10'
  it('vale para abiertas sin fecha, atrasadas o futuras', () => {
    expect(puedeAgendarParaHoy({ ...TAREA, estado: 'PENDIENTE', fecha: null }, hoy)).toBe(true)
    expect(puedeAgendarParaHoy({ ...TAREA, estado: 'EN_PAUSA', fecha: '2026-11-01' }, hoy)).toBe(true)
    expect(puedeAgendarParaHoy({ ...TAREA, estado: 'PENDIENTE', fecha: '2026-11-20' }, hoy)).toBe(true)
  })
  it('no vale si la fecha es hoy ni si está cerrada', () => {
    expect(puedeAgendarParaHoy({ ...TAREA, estado: 'PENDIENTE', fecha: hoy }, hoy)).toBe(false)
    expect(puedeAgendarParaHoy({ ...TAREA, fecha: null, estado: 'HECHO' }, hoy)).toBe(false)
    expect(puedeAgendarParaHoy({ ...TAREA, fecha: null, estado: 'CANCELADO' }, hoy)).toBe(false)
  })
})
