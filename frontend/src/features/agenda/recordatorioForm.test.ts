import { describe, expect, it } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'
import { armarRequest, exigeDescripcion, MINUTOS_AVISO_EVENTO, requestMovido, valorInicialEvento, valorInicialSuelto, valorInicialTarea, yaPaso } from './recordatorioForm'

const AHORA = new Date('2026-11-10T12:00:00-03:00')

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 4,
    titulo: 'Tarea',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: null,
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

describe('valor inicial', () => {
  it('tarea con fecha y hora: esa fecha y esa hora (sin segundos)', () => {
    expect(valorInicialTarea(tarea({ fecha: '2026-11-12', horaInicio: '16:30:00' }), AHORA)).toBe('2026-11-12T16:30')
  })

  it('tarea solo con fecha: ese día a las 09:00', () => {
    expect(valorInicialTarea(tarea({ fecha: '2026-11-12' }), AHORA)).toBe('2026-11-12T09:00')
  })

  it('tarea sin fecha: mañana a las 09:00', () => {
    expect(valorInicialTarea(tarea({}), AHORA)).toBe('2026-11-11T09:00')
  })

  it('mañana se calcula en el día local, también cerca de la medianoche', () => {
    expect(valorInicialSuelto(new Date('2026-11-10T23:50:00-03:00'))).toBe('2026-11-11T09:00')
  })
})

describe('yaPaso', () => {
  it('distingue pasado y futuro', () => {
    expect(yaPaso('2026-11-10T11:59', AHORA)).toBe(true)
    expect(yaPaso('2026-11-10T12:01', AHORA)).toBe(false)
  })

  it('un valor vacío o inválido no cuenta como pasado', () => {
    expect(yaPaso('', AHORA)).toBe(false)
    expect(yaPaso('2026-99-99T00:00', AHORA)).toBe(false)
  })
})

describe('armarRequest', () => {
  const deTarea = { tareaId: 4, eventoId: null, canal: 'APP' as const }
  const suelto = { tareaId: null, eventoId: null, canal: 'APP' as const }

  it('una tarea admite descripción vacía y manda los cinco campos', () => {
    expect(armarRequest(deTarea, '2026-11-12T09:00', '')).toEqual({
      ok: true,
      request: { tareaId: 4, eventoId: null, fechaHora: '2026-11-12T09:00:00-03:00', canal: 'APP', descripcion: '' },
    })
  })

  it('un suelto sin descripción (o solo espacios) es un error local', () => {
    expect(armarRequest(suelto, '2026-11-12T09:00', '').ok).toBe(false)
    expect(armarRequest(suelto, '2026-11-12T09:00', '   ').ok).toBe(false)
  })

  it('recorta la descripción y conserva el canal que ya tenía', () => {
    const r = armarRequest({ ...suelto, canal: 'CORREO' }, '2026-11-12T09:00', '  Llamar  ')
    expect(r).toMatchObject({ ok: true, request: { descripcion: 'Llamar', canal: 'CORREO' } })
  })

  it('sin fecha y hora válidas no arma el cuerpo', () => {
    expect(armarRequest(deTarea, '', 'x')).toEqual({ ok: false, error: 'Elige la fecha y la hora del aviso.' })
  })

  it('exigeDescripcion solo sin tarea ni evento', () => {
    expect(exigeDescripcion(suelto)).toBe(true)
    expect(exigeDescripcion(deTarea)).toBe(false)
    expect(exigeDescripcion({ tareaId: null, eventoId: 2 })).toBe(false)
  })
})

describe('requestMovido', () => {
  const base: Recordatorio = { id: 5, tareaId: 4, eventoId: null, fechaHora: '2026-11-10T09:00:00-03:00', canal: 'APP', enviado: false, descripcion: 'Llamar' }

  it('lleva los cinco campos: ids, canal y descripción originales con la fecha nueva', () => {
    expect(requestMovido(base, '2026-11-13T09:00:00-03:00')).toEqual({
      tareaId: 4,
      eventoId: null,
      fechaHora: '2026-11-13T09:00:00-03:00',
      canal: 'APP',
      descripcion: 'Llamar',
    })
  })

  it('descripción null -> cadena vacía y el canal no se cambia', () => {
    const r = requestMovido({ ...base, descripcion: null, canal: 'CORREO' }, '2026-11-13T09:00:00-03:00')
    expect(r.descripcion).toBe('')
    expect(r.canal).toBe('CORREO')
  })
})

describe('valor inicial de un evento', () => {
  const evento = (inicio: string, fin: string): Evento => ({
    id: 9,
    titulo: 'Dentista',
    descripcion: null,
    fechaHoraInicio: inicio,
    fechaHoraFin: fin,
    prioridad: null,
  })

  it('el aviso va 60 minutos antes del inicio', () => {
    expect(MINUTOS_AVISO_EVENTO).toBe(60)
    expect(valorInicialEvento(evento('2026-12-15T09:30:00-03:00', '2026-12-15T10:30:00-03:00'))).toBe('2026-12-15T08:30')
  })

  it('un evento que empieza de madrugada avisa el día anterior', () => {
    expect(valorInicialEvento(evento('2026-12-15T00:30:00-03:00', '2026-12-15T01:30:00-03:00'))).toBe('2026-12-14T23:30')
  })

  it('de día completo: su primer día a las 09:00', () => {
    expect(valorInicialEvento(evento('2026-12-15T00:00:00-03:00', '2026-12-16T00:00:00-03:00'))).toBe('2026-12-15T09:00')
  })

  it('de varios días completos: el primer día a las 09:00', () => {
    expect(valorInicialEvento(evento('2026-12-15T00:00:00-03:00', '2026-12-18T00:00:00-03:00'))).toBe('2026-12-15T09:00')
  })
})
