import { describe, expect, it } from 'vitest'

import type { ValoresEvento } from './formularioEvento'
import {
  aRequestSerie,
  calcularSerie,
  fechasDeSerie,
  hoyDe,
  minutosAntesDe,
  textoVistaPrevia,
  valoresSerieIniciales,
  volverASuelto,
  type ReglaSerie,
  type ValoresSerie,
} from './formularioSerie'

// 2026-11-16 es lunes.
const HOY = '2026-11-16'
const AHORA = '2026-11-16T10:00:00-03:00'
const ZONA = 'America/Argentina/Buenos_Aires'

const semanal = (parcial: Partial<ReglaSerie> = {}): ReglaSerie => ({ frecuencia: 'SEMANAL', dias: ['LUNES'], intervalo: 1, diaMes: 1, repeticiones: 3, ...parcial })
const mensual = (parcial: Partial<ReglaSerie> = {}): ReglaSerie => ({ frecuencia: 'MENSUAL', dias: [], intervalo: 1, diaMes: 31, repeticiones: 3, ...parcial })

describe('fechasDeSerie: semanal', () => {
  it('lunes y miércoles desde un lunes: empieza hoy porque hoy es día de la regla', () => {
    expect(fechasDeSerie(semanal({ dias: ['LUNES', 'MIERCOLES'], repeticiones: 4 }), HOY)).toEqual(['2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25'])
  })

  it('si hoy no es día de la regla, empieza el primer día que sí lo es', () => {
    expect(fechasDeSerie(semanal({ dias: ['MARTES'], repeticiones: 2 }), HOY)).toEqual(['2026-11-17', '2026-11-24'])
  })

  it('un domingo con la regla en lunes empieza el lunes siguiente', () => {
    expect(fechasDeSerie(semanal({ repeticiones: 2 }), '2026-11-15')).toEqual(['2026-11-16', '2026-11-23'])
  })

  it('cada 2 semanas se cuenta desde la semana de la primera ocurrencia y no incluye días anteriores a hoy', () => {
    // Hoy es miércoles 18: el lunes 16 ya pasó, así que la primera es el viernes 20 y la siguiente semana válida es la del 30.
    expect(fechasDeSerie(semanal({ dias: ['LUNES', 'VIERNES'], intervalo: 2, repeticiones: 5 }), '2026-11-18')).toEqual([
      '2026-11-20',
      '2026-11-30',
      '2026-12-04',
      '2026-12-14',
      '2026-12-18',
    ])
  })

  it('con «hasta» incluye el día final y no pasa de él', () => {
    expect(fechasDeSerie(semanal({ repeticiones: undefined, hasta: '2026-11-30' }), HOY)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30'])
    expect(fechasDeSerie(semanal({ repeticiones: undefined, hasta: '2026-11-29' }), HOY)).toEqual(['2026-11-16', '2026-11-23'])
  })

  it('sin días o sin final no genera nada (y no se cuelga)', () => {
    expect(fechasDeSerie(semanal({ dias: [] }), HOY)).toEqual([])
    expect(fechasDeSerie(semanal({ repeticiones: undefined }), HOY)).toEqual([])
  })
})

describe('fechasDeSerie: mensual', () => {
  it('el día 31 cae en el último día de los meses cortos (el ajuste es por mes, no se acumula)', () => {
    expect(fechasDeSerie(mensual({ repeticiones: 5 }), '2027-01-15')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31'])
  })

  it('en un año bisiesto febrero llega a 29', () => {
    expect(fechasDeSerie(mensual({ diaMes: 30 }), '2028-01-15')).toEqual(['2028-01-30', '2028-02-29', '2028-03-30'])
  })

  it('si el día del mes ya pasó, empieza el mes siguiente; si es hoy, hoy', () => {
    expect(fechasDeSerie(mensual({ diaMes: 10, repeticiones: 2 }), HOY)).toEqual(['2026-12-10', '2027-01-10'])
    expect(fechasDeSerie(mensual({ diaMes: 16, repeticiones: 2 }), HOY)).toEqual(['2026-11-16', '2026-12-16'])
  })

  it('con «hasta» corta en la última ocurrencia que entra', () => {
    expect(fechasDeSerie(mensual({ diaMes: 10, repeticiones: undefined, hasta: '2027-01-09' }), HOY)).toEqual(['2026-12-10'])
  })
})

describe('fechasDeSerie: tope', () => {
  const todosLosDias: ReglaSerie['dias'] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

  it('260 repeticiones caben exactas', () => {
    expect(fechasDeSerie(semanal({ dias: todosLosDias, repeticiones: 260 }), HOY)).toHaveLength(260)
  })

  it('un final lejano se corta en 261 (el tope + 1): alcanza para saber que se pasa', () => {
    expect(fechasDeSerie(semanal({ dias: todosLosDias, repeticiones: undefined, hasta: '2100-01-01' }), HOY)).toHaveLength(261)
  })
})

describe('hoyDe', () => {
  it('es el día local del instante, sin pasar por UTC', () => {
    expect(hoyDe('2026-11-16T23:30:00-03:00')).toBe('2026-11-16')
  })
})

const serie = (parcial: Partial<ValoresSerie> = {}): ValoresSerie => ({
  ...valoresSerieIniciales(HOY),
  repetir: 'SEMANAL',
  diasSemana: ['LUNES'],
  ...parcial,
})

describe('valoresSerieIniciales', () => {
  it('toma el día de la semana y del mes de la fecha elegida; «No se repite», 10 veces, sin recordatorio', () => {
    expect(valoresSerieIniciales('2026-11-20')).toEqual({
      repetir: 'no',
      diasSemana: ['VIERNES'],
      intervaloSemanas: '1',
      diaMes: '20',
      final: 'repeticiones',
      repeticiones: '10',
      hasta: '2027-02-18',
      conRecordatorio: false,
      minutosAntes: '60',
    })
  })

  it('con una fecha inválida no inventa días', () => {
    expect(valoresSerieIniciales('').diasSemana).toEqual([])
  })
})

describe('calcularSerie: validación', () => {
  const calcular = (s: ValoresSerie, ini = '07:00', fin = '08:00', todoElDia = false) => calcularSerie(s, ini, fin, HOY, todoElDia)
  const errores = (s: ValoresSerie, ini?: string, fin?: string, todoElDia?: boolean) => {
    const r = calcular(s, ini, fin, todoElDia)
    return r.ok ? {} : r.errores
  }

  it('una serie válida devuelve sus fechas', () => {
    const r = calcular(serie({ repeticiones: '3' }))
    expect(r).toEqual({ ok: true, fechas: ['2026-11-16', '2026-11-23', '2026-11-30'] })
  })

  it('semanal sin ningún día', () => {
    expect(errores(serie({ diasSemana: [] })).dias).toBe('Elige al menos un día de la semana')
  })

  it.each(['', '0', '32', 'abc', '-1', '1.5'])('día del mes %j', (diaMes) => {
    expect(errores(serie({ repetir: 'MENSUAL', diaMes })).diaMes).toBe('Indica un día del mes entre 1 y 31')
  })

  it.each(['', '0', '261', 'abc', '-3'])('repeticiones %j', (repeticiones) => {
    expect(errores(serie({ repeticiones })).final).toBe('Indica entre 1 y 260 veces')
  })

  it('«El día» vacío, inválido o anterior a hoy', () => {
    expect(errores(serie({ final: 'hasta', hasta: '' })).final).toBe('Indica la fecha final')
    expect(errores(serie({ final: 'hasta', hasta: '2026-02-30' })).final).toBe('Indica la fecha final')
    expect(errores(serie({ final: 'hasta', hasta: '2026-11-15' })).final).toBe('La fecha final no puede ser anterior a hoy')
  })

  it('«El día» sin ninguna ocurrencia entre hoy y esa fecha', () => {
    expect(errores(serie({ diasSemana: ['MARTES'], final: 'hasta', hasta: HOY })).final).toBe('No hay ninguna fecha entre hoy y el lun 16 nov')
  })

  it('más de 260 eventos: no se manda, se pide un final más cercano', () => {
    const todos = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const
    expect(errores(serie({ diasSemana: [...todos], final: 'hasta', hasta: '2100-01-01' })).final).toBe(
      'Serían más de 260 eventos, que es el máximo: elige un final más cercano',
    )
  })

  it('horas faltantes, iguales (todo el día) o de todo el día marcado', () => {
    expect(errores(serie(), '', '08:00').horas).toBe('Indica la hora de inicio')
    expect(errores(serie(), '07:00', '').horas).toBe('Indica la hora de fin')
    expect(errores(serie(), '07:00', '07:00').horas).toBe('La hora de fin debe ser distinta de la de inicio')
    expect(errores(serie(), '07:00', '08:00', true).horas).toBe('Los eventos de todo el día no se pueden repetir')
  })

  it('una hora de fin anterior a la de inicio es válida (termina al día siguiente)', () => {
    expect(calcular(serie({ repeticiones: '1' }), '23:00', '01:00').ok).toBe(true)
  })

  it('minutos del recordatorio: 0 y 10080 valen; 10081, negativos y texto no', () => {
    expect(calcular(serie({ repeticiones: '1', conRecordatorio: true, minutosAntes: '0' })).ok).toBe(true)
    expect(calcular(serie({ repeticiones: '1', conRecordatorio: true, minutosAntes: '10080' })).ok).toBe(true)
    for (const minutosAntes of ['10081', '-5', 'x', '']) {
      expect(errores(serie({ conRecordatorio: true, minutosAntes })).minutos).toBe('Indica entre 0 y 10080 minutos')
    }
    // Sin la casilla, los minutos no se miran.
    expect(calcular(serie({ repeticiones: '1', conRecordatorio: false, minutosAntes: 'x' })).ok).toBe(true)
  })
})

describe('textoVistaPrevia', () => {
  it('cuántos eventos y entre qué días', () => {
    expect(textoVistaPrevia(['2026-11-16', '2026-11-23', '2026-12-16'], HOY, HOY)).toBe('Se crearán 3 eventos, del lun 16 nov al mié 16 dic.')
  })

  it('un solo evento', () => {
    expect(textoVistaPrevia(['2026-11-16'], HOY, HOY)).toBe('Se creará 1 evento, el lun 16 nov.')
  })

  it('no avisa si el día elegido es la primera ocurrencia', () => {
    expect(textoVistaPrevia(['2026-11-20', '2026-11-27'], HOY, '2026-11-20')).toBe('Se crearán 2 eventos, del vie 20 nov al vie 27 nov.')
  })

  it('avisa que la serie cuenta desde hoy cuando el día elegido es otro', () => {
    expect(textoVistaPrevia(['2026-11-16', '2026-11-23'], HOY, '2026-12-01')).toBe(
      'Se crearán 2 eventos, del lun 16 nov al lun 23 nov. La serie cuenta desde hoy, no desde el mar 1 dic.',
    )
  })
})

describe('aRequestSerie', () => {
  const valores: ValoresEvento = {
    titulo: '  Gimnasio  ',
    descripcion: ' con pesas ',
    prioridad: 'ALTA',
    todoElDia: false,
    fechaInicio: '2026-11-20',
    horaInicio: '07:00',
    fechaFin: '2026-11-20',
    horaFin: '08:00',
  }
  const contexto = { ahora: AHORA, zona: ZONA }

  function pedir(s: ValoresSerie, v: ValoresEvento = valores, ctx = contexto) {
    const r = aRequestSerie(v, s, ctx)
    if (!r.ok) throw new Error(`se esperaba un request válido: ${JSON.stringify(r)}`)
    return r
  }

  it('semanal: días e intervalo, sin diaMes, con un solo final y sin recordatorio', () => {
    const { request } = pedir(serie({ diasSemana: ['LUNES', 'MIERCOLES'], intervaloSemanas: '2', repeticiones: '10' }))
    expect(request).toEqual({
      titulo: 'Gimnasio',
      descripcion: 'con pesas',
      prioridad: 'ALTA',
      horaInicio: '07:00',
      horaFin: '08:00',
      zonaHoraria: ZONA,
      ahora: AHORA,
      frecuencia: 'SEMANAL',
      diasSemana: ['LUNES', 'MIERCOLES'],
      intervaloSemanas: 2,
      repeticiones: 10,
    })
    expect(request).not.toHaveProperty('diaMes')
    expect(request).not.toHaveProperty('hasta')
    expect(request).not.toHaveProperty('recordatorio')
  })

  it('mensual: solo diaMes (ni días ni intervalo)', () => {
    const { request } = pedir(serie({ repetir: 'MENSUAL', diaMes: '31', diasSemana: ['LUNES'], intervaloSemanas: '2' }))
    expect(request.frecuencia).toBe('MENSUAL')
    expect(request.diaMes).toBe(31)
    expect(request).not.toHaveProperty('diasSemana')
    expect(request).not.toHaveProperty('intervaloSemanas')
  })

  it('con «El día» manda hasta y no repeticiones', () => {
    const { request } = pedir(serie({ final: 'hasta', hasta: '2026-12-31', repeticiones: '99' }))
    expect(request.hasta).toBe('2026-12-31')
    expect(request).not.toHaveProperty('repeticiones')
  })

  it('el recordatorio viaja solo si la casilla está marcada; 0 minutos es válido', () => {
    expect(pedir(serie({ conRecordatorio: true, minutosAntes: '30' })).request.recordatorio).toEqual({ minutosAntes: 30 })
    expect(pedir(serie({ conRecordatorio: true, minutosAntes: '0' })).request.recordatorio).toEqual({ minutosAntes: 0 })
    expect(pedir(serie({ conRecordatorio: false, minutosAntes: '30' })).request).not.toHaveProperty('recordatorio')
  })

  it('prioridad vacía = null y horas con segundos se recortan a HH:mm', () => {
    const { request } = pedir(serie(), { ...valores, prioridad: '', horaInicio: '07:00:00', horaFin: '08:00:00' })
    expect(request.prioridad).toBeNull()
    expect(request.horaInicio).toBe('07:00')
    expect(request.horaFin).toBe('08:00')
  })

  it('«hoy» sale de la misma `ahora` que viaja: la primera fecha cambia con ella', () => {
    expect(pedir(serie({ diasSemana: ['LUNES'] })).fechas[0]).toBe('2026-11-16')
    expect(pedir(serie({ diasSemana: ['LUNES'] }), valores, { ahora: '2090-01-02T08:00:00-03:00', zona: ZONA }).fechas[0]).toBe('2090-01-02')
  })

  it('título vacío y serie inválida: devuelve los dos errores a la vez', () => {
    const r = aRequestSerie({ ...valores, titulo: '  ' }, serie({ diasSemana: [] }), contexto)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errores.titulo).toBe('El título es obligatorio')
      expect(r.erroresSerie.dias).toBe('Elige al menos un día de la semana')
    }
  })

  it('«Todo el día» marcado no se puede repetir', () => {
    const r = aRequestSerie({ ...valores, todoElDia: true }, serie(), contexto)
    expect(r.ok).toBe(false)
  })
})

describe('minutosAntesDe', () => {
  const INICIO = '2026-12-15T09:00:00-03:00'

  it('cuántos minutos antes del inicio cae el recordatorio', () => {
    expect(minutosAntesDe(INICIO, '2026-12-15T08:00:00-03:00')).toBe(60)
    expect(minutosAntesDe(INICIO, INICIO)).toBe(0)
  })

  it('compara instantes: el mismo momento con otro desfase da lo mismo', () => {
    expect(minutosAntesDe(INICIO, '2026-12-15T11:30:00+00:00')).toBe(30)
  })

  it('después del inicio o a más de 7 días: no cabe (null)', () => {
    expect(minutosAntesDe(INICIO, '2026-12-15T09:30:00-03:00')).toBeNull()
    expect(minutosAntesDe(INICIO, '2026-12-08T09:00:00-03:00')).toBe(10080)
    expect(minutosAntesDe(INICIO, '2026-12-08T08:59:00-03:00')).toBeNull()
  })
})

describe('volverASuelto', () => {
  it('restaura el día de inicio y el de fin que tenía el formulario', () => {
    expect(volverASuelto({ horaInicio: '09:00', horaFin: '10:00' }, { fechaInicio: '2026-12-15', fechaFin: '2026-12-15' })).toEqual({
      fechaInicio: '2026-12-15',
      fechaFin: '2026-12-15',
    })
  })

  it('respeta un evento de varios días que ya se había armado', () => {
    expect(volverASuelto({ horaInicio: '09:00', horaFin: '10:00' }, { fechaInicio: '2026-12-15', fechaFin: '2026-12-17' })).toEqual({
      fechaInicio: '2026-12-15',
      fechaFin: '2026-12-17',
    })
  })

  it('si con las horas editadas el fin no queda después del inicio, pasa al día siguiente', () => {
    expect(volverASuelto({ horaInicio: '23:00', horaFin: '01:00' }, { fechaInicio: '2026-12-15', fechaFin: '2026-12-15' })).toEqual({
      fechaInicio: '2026-12-15',
      fechaFin: '2026-12-16',
    })
  })
})
