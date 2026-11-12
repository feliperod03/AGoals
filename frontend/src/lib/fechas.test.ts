import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deFechaYHoraLocal,
  esDeDiasCompletos,
  esHoraValida,
  formatearRangoEvento,
  mensajeEventoBorrado,
  mensajeEventoCreado,
  mensajeEventoEmpieza,
  mensajeEventoGuardado,
  mensajeEventoYaNoExistia,
  minutosEntre,
  partesLocales,
  sumarMinutos,
  aFechaLocal,
  aValorDatetimeLocal,
  deValorDatetimeLocal,
  mensajeRecordatorioCreado,
  mensajeRecordatorioGuardado,
  mensajeRecordatorioQuitado,
  mensajeRecordatorioMovido,
  mensajeRecordatorioNoMovido,
  mensajeSinFechaConRecordatorio,
  diasEntre,
  moverInstanteDias,
  aIsoConDesfase,
  esAtrasada,
  ahora,
  formatearDesfase,
  formatearDiaMes,
  formatearFechaCorta,
  formatearFechaHoraCorta,
  formatearFechaLarga,
  mensajeIdeaBorrada,
  mensajeIdeaConcluida,
  mensajeIdeaCreada,
  mensajeIdeaGuardada,
  mensajeIdeaReabierta,
  formatearHora,
  formatearMinutos,
  hoy,
  mensajeAgendada,
  mensajeBorrada,
  fechaMinimaParaPosponer,
  mensajeGuardada,
  compararFechaHora,
  mensajeSinFecha,
  puedePosponerAManana,
  sumarDias,
  mensajePospuesta,
  mensajeMadreCambiada,
  mensajeTareaDesvinculada,
  mensajeTareaVinculada,
  mensajeSubtareaAgregada,
  minutosDeHora,
  minutosDelDia,
  rangoDelDia,
  recortarEventoAlDia,
  esFechaValida,
  formatearDiaSemana,
  formatearMes,
  limitesDeSemana,
  mesActual,
  mesDe,
  moverMesConservandoDia,
  nombresDiasSemana,
  parsearMes,
  rangoDeFechas,
  semanasDelMes,
  sumarMeses,
  tramoDelEventoEnDia,
  diasDeLaSemana,
  formatearDiaCorto,
  formatearRangoSemana,
} from './fechas'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

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

describe('formatearFechaCorta', () => {
  it('escribe el día local con año', () => {
    expect(formatearFechaCorta('2026-11-10T15:00:00-03:00')).toBe('10 nov 2026')
  })

  it('cerca de la medianoche cuenta el día local, no el del texto (zona de los tests: Buenos Aires)', () => {
    // 23:30 del 10 en Buenos Aires.
    expect(formatearFechaCorta('2026-11-10T23:30:00-03:00')).toBe('10 nov 2026')
    // El mismo instante escrito en UTC ya dice 11, pero el día local sigue siendo el 10.
    expect(formatearFechaCorta('2026-11-11T02:30:00+00:00')).toBe('10 nov 2026')
    // Con otro desfase: 00:10 del 11 en +02:00 es el 10 a las 19:10 en Buenos Aires.
    expect(formatearFechaCorta('2026-11-11T00:10:00+02:00')).toBe('10 nov 2026')
    // Un minuto después de la medianoche local ya es el 11.
    expect(formatearFechaCorta('2026-11-11T00:01:00-03:00')).toBe('11 nov 2026')
  })
})

describe('mensajes de ideas', () => {
  it('nombran la idea entre comillas angulares', () => {
    expect(mensajeIdeaCreada('Cantar')).toBe('Idea «Cantar» creada')
    expect(mensajeIdeaGuardada('Cantar')).toBe('Idea «Cantar» guardada')
    expect(mensajeIdeaConcluida('Cantar')).toBe('Idea «Cantar» concluida')
    expect(mensajeIdeaReabierta('Cantar')).toBe('Idea «Cantar» reabierta')
    expect(mensajeIdeaBorrada('Cantar')).toBe('Idea «Cantar» borrada')
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

describe('mensajeSubtareaAgregada', () => {
  it('con fecha: nombra a la madre entre comillas angulares', () => {
    expect(mensajeSubtareaAgregada('Mudanza', '2026-11-12')).toBe('Subtarea agregada a «Mudanza»')
  })

  it('sin fecha: avisa que está en el Cofre', () => {
    expect(mensajeSubtareaAgregada('Mudanza', null)).toBe('Subtarea agregada a «Mudanza»; sin fecha: la verás en el Cofre')
  })
})

describe('mensajeMadreCambiada', () => {
  it('con madre nueva', () => {
    expect(mensajeMadreCambiada('Embalar', 'Mudanza')).toBe('«Embalar» ahora es subtarea de «Mudanza»')
  })
  it('sin madre', () => {
    expect(mensajeMadreCambiada('Embalar', null)).toBe('«Embalar» ya no es subtarea')
  })
})

describe('mensajePospuesta', () => {
  it('escribe la fecha en español', () => {
    expect(mensajePospuesta('2026-11-10')).toBe('Pospuesta al 10 de noviembre')
    expect(mensajePospuesta('2026-12-01')).toBe('Pospuesta al 1 de diciembre')
  })
})

describe('formatearDiaMes', () => {
  it('escribe día y mes en español', () => {
    expect(formatearDiaMes('2026-11-03')).toBe('3 de noviembre')
  })
})

describe('esAtrasada', () => {
  it('es verdadera solo si la fecha es anterior a hoy', () => {
    expect(esAtrasada('2026-11-09', '2026-11-10')).toBe(true)
    expect(esAtrasada('2026-11-10', '2026-11-10')).toBe(false)
    expect(esAtrasada('2026-11-11', '2026-11-10')).toBe(false)
    expect(esAtrasada(null, '2026-11-10')).toBe(false)
  })
})

describe('mensajeAgendada', () => {
  it('sin subtareas no lleva paréntesis', () => {
    expect(mensajeAgendada('Comprar pan', 0)).toBe('«Comprar pan» agendada para hoy')
  })
  it('con subtareas dice cuántas, en singular o plural', () => {
    expect(mensajeAgendada('Informe', 1)).toBe('«Informe» agendada para hoy (con 1 subtarea)')
    expect(mensajeAgendada('Informe', 3)).toBe('«Informe» agendada para hoy (con 3 subtareas)')
  })
})

describe('sumarDias', () => {
  it('suma días cruzando mes y año', () => {
    expect(sumarDias('2026-11-10', 1)).toBe('2026-11-11')
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('fechaMinimaParaPosponer', () => {
  it('es mañana si la tarea es de hoy, atrasada o no tiene fecha', () => {
    expect(fechaMinimaParaPosponer('2026-11-10', '2026-11-10')).toBe('2026-11-11')
    expect(fechaMinimaParaPosponer('2026-11-05', '2026-11-10')).toBe('2026-11-11')
    expect(fechaMinimaParaPosponer(null, '2026-11-10')).toBe('2026-11-11')
  })
  it('es el día siguiente a la fecha de la tarea si esta es de mañana o posterior', () => {
    expect(fechaMinimaParaPosponer('2026-11-11', '2026-11-10')).toBe('2026-11-12')
    expect(fechaMinimaParaPosponer('2026-11-20', '2026-11-10')).toBe('2026-11-21')
  })
})

describe('puedePosponerAManana', () => {
  it('solo si la fecha de la tarea es anterior a mañana', () => {
    expect(puedePosponerAManana('2026-11-05', '2026-11-10')).toBe(true)
    expect(puedePosponerAManana('2026-11-10', '2026-11-10')).toBe(true)
    expect(puedePosponerAManana('2026-11-11', '2026-11-10')).toBe(false)
    expect(puedePosponerAManana('2026-11-20', '2026-11-10')).toBe(false)
    expect(puedePosponerAManana(null, '2026-11-10')).toBe(false)
  })
})

describe('mensajeSinFecha', () => {
  it('manda al Cofre y a Recomendación', () => {
    expect(mensajeSinFecha()).toBe('Sin fecha: la verás en el Cofre y en Recomendación')
  })
})

describe('compararFechaHora', () => {
  it('ordena instantes ISO, también con distinto desfase', () => {
    expect(compararFechaHora('2026-11-01T10:00:00-03:00', '2026-11-02T10:00:00-03:00')).toBeLessThan(0)
    expect(compararFechaHora('2026-11-02T10:00:00-03:00', '2026-11-01T10:00:00-03:00')).toBeGreaterThan(0)
    expect(compararFechaHora('2026-11-01T10:00:00-03:00', '2026-11-01T13:00:00Z')).toBe(0)
  })
})

describe('mensajeBorrada', () => {
  it('sin modo o sin subtareas solo dice que se borró', () => {
    expect(mensajeBorrada('Pan', 0)).toBe('«Pan» borrada')
    expect(mensajeBorrada('Pan', 3)).toBe('«Pan» borrada')
    expect(mensajeBorrada('Pan', 0, 'borrar')).toBe('«Pan» borrada')
  })

  it('conservar y borrar, en singular y plural', () => {
    expect(mensajeBorrada('Pan', 3, 'conservar')).toBe('«Pan» borrada; sus 3 subtareas se conservaron')
    expect(mensajeBorrada('Pan', 1, 'conservar')).toBe('«Pan» borrada; su subtarea se conservó')
    expect(mensajeBorrada('Pan', 3, 'borrar')).toBe('«Pan» borrada con 3 subtareas')
    expect(mensajeBorrada('Pan', 1, 'borrar')).toBe('«Pan» borrada con 1 subtarea')
  })
})

describe('mensajes de vínculo con proyecto u objetivo', () => {
  it('avisa al ligar', () => {
    expect(mensajeTareaVinculada('Embalar', 'proyecto', 'Mudanza')).toBe('«Embalar» ahora es del proyecto «Mudanza»')
    expect(mensajeTareaVinculada('Embalar', 'objetivo', 'Vivir solo')).toBe('«Embalar» ahora es del objetivo «Vivir solo»')
  })

  it('avisa al quitar', () => {
    expect(mensajeTareaDesvinculada('Embalar', 'proyecto', 'Mudanza')).toBe('«Embalar» ya no es del proyecto «Mudanza»')
    expect(mensajeTareaDesvinculada('Embalar', 'objetivo', 'Vivir solo')).toBe('«Embalar» ya no es del objetivo «Vivir solo»')
  })
})

describe('valor de datetime-local', () => {
  it('ISO con desfase -03:00 -> hora local sin segundos ni zona', () => {
    expect(aValorDatetimeLocal('2026-11-10T15:00:00-03:00')).toBe('2026-11-10T15:00')
  })

  it('un ISO en otro desfase se muestra en la hora local (-03:00), cruzando el día si hace falta', () => {
    // 01:30 en +05:30 es 20:00 UTC del día anterior = 17:00 en Buenos Aires.
    expect(aValorDatetimeLocal('2026-11-10T01:30:00+05:30')).toBe('2026-11-09T17:00')
  })

  it('valor -> ISO con el desfase de la zona local (-03:00)', () => {
    expect(deValorDatetimeLocal('2026-11-10T15:00')).toBe('2026-11-10T15:00:00-03:00')
  })

  it('cerca de la medianoche conserva el día y la hora', () => {
    expect(deValorDatetimeLocal('2026-11-10T23:59')).toBe('2026-11-10T23:59:00-03:00')
    expect(deValorDatetimeLocal('2026-11-11T00:00')).toBe('2026-11-11T00:00:00-03:00')
    expect(aValorDatetimeLocal('2026-11-11T00:00:00-03:00')).toBe('2026-11-11T00:00')
  })

  it('vacío o inválido -> null (nunca se manda un Invalid Date)', () => {
    expect(deValorDatetimeLocal('')).toBeNull()
    expect(deValorDatetimeLocal('2026-13-45T99:99')).toBeNull()
  })

  it('en una zona con desfase positivo (+05:30) el ISO lleva ese desfase y la ida y vuelta es la misma', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    try {
      expect(deValorDatetimeLocal('2026-11-10T15:00')).toBe('2026-11-10T15:00:00+05:30')
      expect(aValorDatetimeLocal('2026-11-10T15:00:00+05:30')).toBe('2026-11-10T15:00')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('mensajes de recordatorios', () => {
  it('creado y guardado nombran la fecha y hora; quitado no', () => {
    expect(mensajeRecordatorioCreado('2026-11-09T15:00:00-03:00')).toBe('Recordatorio creado para el lun 9 nov · 15:00')
    expect(mensajeRecordatorioGuardado('2026-11-09T15:00:00-03:00')).toBe('Recordatorio guardado para el lun 9 nov · 15:00')
    expect(mensajeRecordatorioQuitado()).toBe('Recordatorio quitado')
  })
})

describe('diasEntre', () => {
  it('cuenta días de calendario dentro del mes, entre meses y entre años', () => {
    expect(diasEntre('2026-11-10', '2026-11-14')).toBe(4)
    expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3)
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('respeta el año bisiesto', () => {
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2)
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1)
  })

  it('0 para el mismo día y negativo hacia atrás', () => {
    expect(diasEntre('2026-11-10', '2026-11-10')).toBe(0)
    expect(diasEntre('2026-11-10', '2026-11-07')).toBe(-3)
  })

  it('no depende del cambio de horario (fin de DST en Nueva York)', () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(diasEntre('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('moverInstanteDias', () => {
  it('en Buenos Aires conserva la hora y el desfase', () => {
    expect(moverInstanteDias('2026-11-09T15:00:00-03:00', 4)).toBe('2026-11-13T15:00:00-03:00')
  })

  it('cruza fin de mes y año, y acepta días negativos', () => {
    expect(moverInstanteDias('2026-12-30T09:00:00-03:00', 3)).toBe('2027-01-02T09:00:00-03:00')
    expect(moverInstanteDias('2026-11-10T09:00:00-03:00', -2)).toBe('2026-11-08T09:00:00-03:00')
  })

  it('conserva la hora de pared al cruzar el fin del horario de verano (la hora 09:00 sigue siendo 09:00)', () => {
    vi.stubEnv('TZ', 'America/New_York')
    // El 1/11/2026 termina el horario de verano: el desfase pasa de -04:00 a -05:00.
    expect(moverInstanteDias('2026-10-31T09:00:00-04:00', 2)).toBe('2026-11-02T09:00:00-05:00')
  })

  it('en una zona con desfase positivo conserva la hora y el desfase', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    expect(moverInstanteDias('2026-11-10T09:00:00+05:30', 3)).toBe('2026-11-13T09:00:00+05:30')
  })
})

describe('mensajes de mover el recordatorio al posponer', () => {
  it('movido nombra la fecha de la tarea y el nuevo instante del aviso', () => {
    expect(mensajeRecordatorioMovido('2026-11-11', '2026-11-10T15:00:00-03:00')).toBe(
      'Pospuesta al 11 de noviembre; recordatorio movido al mar 10 nov · 15:00',
    )
  })

  it('no movido incluye el mensaje del servidor', () => {
    expect(mensajeRecordatorioNoMovido('2026-11-11', 'Recordatorio no encontrado: 5')).toBe(
      'Pospuesta al 11 de noviembre, pero no se pudo mover el recordatorio (Recordatorio no encontrado: 5). Revísalo en «Recordatorio…»',
    )
  })

  it('sin fecha con recordatorio avisa que no se movió', () => {
    expect(mensajeSinFechaConRecordatorio()).toBe('Sin fecha: la verás en el Cofre y en Recomendación; el recordatorio no se movió')
  })
})

describe('mesDe / mesActual / parsearMes / esFechaValida', () => {
  it('mesDe toma el mes de una fecha', () => {
    expect(mesDe('2026-11-10')).toBe('2026-11')
  })

  it('mesActual usa el reloj local', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'))
    expect(mesActual()).toBe('2026-11')
  })

  it('parsearMes acepta YYYY-MM válido y rechaza el resto', () => {
    expect(parsearMes('2026-11')).toBe('2026-11')
    expect(parsearMes('2026-12')).toBe('2026-12')
    for (const malo of ['2026-13', '2026-00', '2026-1', 'abc', '', '2026-11-10', null]) {
      expect(parsearMes(malo)).toBeNull()
    }
  })

  it('esFechaValida rechaza fechas inexistentes y mal formadas', () => {
    expect(esFechaValida('2026-11-10')).toBe(true)
    expect(esFechaValida('2028-02-29')).toBe(true)
    for (const mala of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-11-1', 'abc', '', null]) {
      expect(esFechaValida(mala)).toBe(false)
    }
  })
})

describe('sumarMeses / moverMesConservandoDia', () => {
  it('suma y resta meses cruzando el año', () => {
    expect(sumarMeses('2026-11', 1)).toBe('2026-12')
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(sumarMeses('2026-11', 0)).toBe('2026-11')
  })

  it('moverMesConservandoDia acota al último día del mes', () => {
    expect(moverMesConservandoDia('2026-10-31', 1)).toBe('2026-11-30')
    expect(moverMesConservandoDia('2026-01-31', 1)).toBe('2026-02-28')
    expect(moverMesConservandoDia('2028-01-31', 1)).toBe('2028-02-29')
    expect(moverMesConservandoDia('2026-01-15', -1)).toBe('2025-12-15')
  })
})

describe('semanasDelMes', () => {
  const comprobarForma = (semanas: string[][]) => {
    for (const semana of semanas) {
      expect(semana).toHaveLength(7)
      expect(limitesDeSemana(semana[0] ?? '').lunes).toBe(semana[0])
    }
  }

  it('febrero de 2026 (28 días, empieza en domingo) ocupa 5 semanas', () => {
    const semanas = semanasDelMes('2026-02')
    expect(semanas).toHaveLength(5)
    expect(semanas[0]?.[0]).toBe('2026-01-26')
    expect(semanas[4]?.[6]).toBe('2026-03-01')
    comprobarForma(semanas)
  })

  it('febrero de 2027 (28 días, empieza en lunes) ocupa exactamente 4 semanas', () => {
    const semanas = semanasDelMes('2027-02')
    expect(semanas).toHaveLength(4)
    expect(semanas[0]?.[0]).toBe('2027-02-01')
    expect(semanas[3]?.[6]).toBe('2027-02-28')
    comprobarForma(semanas)
  })

  it('febrero de 2028 tiene 29 días', () => {
    const dias = semanasDelMes('2028-02').flat()
    expect(dias).toContain('2028-02-29')
    expect(dias).not.toContain('2028-02-30')
  })

  it('noviembre de 2026 (30 días, empieza en domingo) ocupa 6 semanas', () => {
    const semanas = semanasDelMes('2026-11')
    expect(semanas).toHaveLength(6)
    expect(semanas[0]?.[0]).toBe('2026-10-26')
    expect(semanas[5]?.[6]).toBe('2026-12-06')
    comprobarForma(semanas)
  })

  it('marzo de 2026 (31 días)', () => {
    const semanas = semanasDelMes('2026-03')
    expect(semanas[0]?.[0]).toBe('2026-02-23')
    expect(semanas.flat()).toContain('2026-03-31')
    comprobarForma(semanas)
  })

  it('no depende de la zona horaria', () => {
    vi.stubEnv('TZ', 'America/New_York')
    const semanas = semanasDelMes('2026-11')
    expect(semanas).toHaveLength(6)
    expect(semanas.flat()).toHaveLength(42)
    expect(new Set(semanas.flat()).size).toBe(42)
  })
})

describe('rangoDeFechas', () => {
  it('va de las 00:00 de la primera a las 00:00 del día siguiente a la última, con el desfase local', () => {
    expect(rangoDeFechas('2026-10-26', '2026-12-06')).toEqual({
      desde: '2026-10-26T00:00:00-03:00',
      hasta: '2026-12-07T00:00:00-03:00',
    })
  })

  it('en Nueva York cruza el fin del horario de verano: -04:00 al inicio y -05:00 al final', () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(rangoDeFechas('2026-10-26', '2026-12-06')).toEqual({
      desde: '2026-10-26T00:00:00-04:00',
      hasta: '2026-12-07T00:00:00-05:00',
    })
  })

  it('en Kolkata usa +05:30', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    expect(rangoDeFechas('2026-10-26', '2026-12-06')).toEqual({
      desde: '2026-10-26T00:00:00+05:30',
      hasta: '2026-12-07T00:00:00+05:30',
    })
  })
})

describe('formatearMes / formatearDiaSemana / limitesDeSemana', () => {
  it('formatea el mes con mayúscula inicial', () => {
    expect(formatearMes('2026-11')).toBe('Noviembre de 2026')
    expect(formatearMes('2027-02')).toBe('Febrero de 2027')
  })

  it('formatea el día con su nombre de semana', () => {
    expect(formatearDiaSemana('2026-11-10')).toBe('martes 10 de noviembre')
  })

  it('el domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(limitesDeSemana('2026-11-08')).toEqual({ lunes: '2026-11-02', domingo: '2026-11-08' })
    expect(limitesDeSemana('2026-11-09')).toEqual({ lunes: '2026-11-09', domingo: '2026-11-15' })
    expect(limitesDeSemana('2026-11-10')).toEqual({ lunes: '2026-11-09', domingo: '2026-11-15' })
  })
})

describe('tramoDelEventoEnDia', () => {
  it('evento dentro del día', () => {
    const e = { fechaHoraInicio: '2026-11-10T09:00:00-03:00', fechaHoraFin: '2026-11-10T10:30:00-03:00' }
    expect(tramoDelEventoEnDia(e, '2026-11-10')).toEqual({ inicioMin: 540, finMin: 630, empiezaAntes: false, terminaDespues: false })
    expect(tramoDelEventoEnDia(e, '2026-11-11')).toBeNull()
  })

  it('cruza la medianoche: dos tramos', () => {
    const e = { fechaHoraInicio: '2026-11-10T22:00:00-03:00', fechaHoraFin: '2026-11-11T02:00:00-03:00' }
    expect(tramoDelEventoEnDia(e, '2026-11-10')).toEqual({ inicioMin: 1320, finMin: 1440, empiezaAntes: false, terminaDespues: true })
    expect(tramoDelEventoEnDia(e, '2026-11-11')).toEqual({ inicioMin: 0, finMin: 120, empiezaAntes: true, terminaDespues: false })
  })

  it('de tres días: el del medio ocupa el día entero', () => {
    const e = { fechaHoraInicio: '2026-12-02T09:00:00-03:00', fechaHoraFin: '2026-12-04T18:00:00-03:00' }
    expect(tramoDelEventoEnDia(e, '2026-12-03')).toEqual({ inicioMin: 0, finMin: 1440, empiezaAntes: true, terminaDespues: true })
    expect(tramoDelEventoEnDia(e, '2026-12-04')).toEqual({ inicioMin: 0, finMin: 1080, empiezaAntes: true, terminaDespues: false })
  })

  it('cruza el fin de mes', () => {
    const e = { fechaHoraInicio: '2026-10-31T20:00:00-03:00', fechaHoraFin: '2026-11-01T10:00:00-03:00' }
    expect(tramoDelEventoEnDia(e, '2026-10-31')?.terminaDespues).toBe(true)
    expect(tramoDelEventoEnDia(e, '2026-11-01')?.empiezaAntes).toBe(true)
  })

  it('los bordes exactos no cuentan', () => {
    const hastaMedianoche = { fechaHoraInicio: '2026-11-10T22:00:00-03:00', fechaHoraFin: '2026-11-11T00:00:00-03:00' }
    expect(tramoDelEventoEnDia(hastaMedianoche, '2026-11-11')).toBeNull()
    expect(tramoDelEventoEnDia(hastaMedianoche, '2026-11-10')).toEqual({ inicioMin: 1320, finMin: 1440, empiezaAntes: false, terminaDespues: false })
    const desdeMedianoche = { fechaHoraInicio: '2026-11-11T00:00:00-03:00', fechaHoraFin: '2026-11-11T01:00:00-03:00' }
    expect(tramoDelEventoEnDia(desdeMedianoche, '2026-11-11')?.empiezaAntes).toBe(false)
    expect(tramoDelEventoEnDia(desdeMedianoche, '2026-11-10')).toBeNull()
  })

  it('en Kolkata se reparte por el día local de esa zona', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    // 23:30 del 10/11 en Buenos Aires = 08:00 del 11/11 en Kolkata.
    const e = { fechaHoraInicio: '2026-11-10T23:30:00-03:00', fechaHoraFin: '2026-11-11T00:30:00-03:00' }
    expect(tramoDelEventoEnDia(e, '2026-11-10')).toBeNull()
    expect(tramoDelEventoEnDia(e, '2026-11-11')).toEqual({ inicioMin: 480, finMin: 540, empiezaAntes: false, terminaDespues: false })
  })
})

describe('nombresDiasSemana', () => {
  it('empieza en lunes y termina en domingo', () => {
    const dias = nombresDiasSemana()
    expect(dias).toHaveLength(7)
    expect(dias[0]).toEqual({ corto: 'lun', largo: 'lunes' })
    expect(dias[2]).toEqual({ corto: 'mié', largo: 'miércoles' })
    expect(dias[6]).toEqual({ corto: 'dom', largo: 'domingo' })
  })
})

describe('diasDeLaSemana', () => {
  it('desde cualquier día devuelve lunes a domingo', () => {
    const semana = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
    expect(diasDeLaSemana('2026-11-09')).toEqual(semana)
    expect(diasDeLaSemana('2026-11-12')).toEqual(semana)
    expect(diasDeLaSemana('2026-11-15')).toEqual(semana)
  })

  it('cruza el mes y el año', () => {
    expect(diasDeLaSemana('2026-12-02')[0]).toBe('2026-11-30')
    expect(diasDeLaSemana('2027-01-01')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ])
  })

  it('no depende de la zona horaria (Kolkata y Nueva York con fin del horario de verano)', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    expect(diasDeLaSemana('2026-11-10')[0]).toBe('2026-11-09')
    expect(rangoDeFechas('2026-11-09', '2026-11-15')).toEqual({
      desde: '2026-11-09T00:00:00+05:30',
      hasta: '2026-11-16T00:00:00+05:30',
    })
    vi.stubEnv('TZ', 'America/New_York')
    // El 1/11/2026 (domingo) termina el horario de verano.
    expect(diasDeLaSemana('2026-11-01')).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ])
    expect(rangoDeFechas('2026-10-26', '2026-11-01')).toEqual({
      desde: '2026-10-26T00:00:00-04:00',
      hasta: '2026-11-02T00:00:00-05:00',
    })
  })
})

describe('formatearRangoSemana / formatearDiaCorto', () => {
  it('mismo mes, cruza el mes y cruza el año', () => {
    expect(formatearRangoSemana('2026-11-09')).toBe('9–15 de noviembre de 2026')
    expect(formatearRangoSemana('2026-11-30')).toBe('30 de noviembre – 6 de diciembre de 2026')
    expect(formatearRangoSemana('2026-12-28')).toBe('28 de diciembre de 2026 – 3 de enero de 2027')
  })

  it('nombre corto del día', () => {
    expect(formatearDiaCorto('2026-11-09')).toBe('lunes 9')
    expect(formatearDiaCorto('2026-11-15')).toBe('domingo 15')
  })
})

describe('eventos (9c): día y hora locales', () => {
  it('esHoraValida acepta HH:mm y HH:mm:ss y rechaza lo demás', () => {
    expect(esHoraValida('09:00')).toBe(true)
    expect(esHoraValida('23:59:30')).toBe(true)
    expect(esHoraValida('')).toBe(false)
    expect(esHoraValida('24:00')).toBe(false)
    expect(esHoraValida('9:00')).toBe(false)
  })

  it('partesLocales lleva el instante a la hora local (Buenos Aires)', () => {
    expect(partesLocales('2026-12-15T09:00:00-03:00')).toEqual({ fecha: '2026-12-15', hora: '09:00' })
    // 01:30 UTC del 16 = 22:30 del 15 en Buenos Aires.
    expect(partesLocales('2026-12-16T01:30:00Z')).toEqual({ fecha: '2026-12-15', hora: '22:30' })
  })

  it('deFechaYHoraLocal arma el ISO con desfase; vacío o inválido = null', () => {
    expect(deFechaYHoraLocal('2026-12-15', '09:00')).toBe('2026-12-15T09:00:00-03:00')
    expect(deFechaYHoraLocal('2026-12-15', '09:00:45')).toBe('2026-12-15T09:00:00-03:00')
    expect(deFechaYHoraLocal('', '09:00')).toBeNull()
    expect(deFechaYHoraLocal('2026-12-15', '')).toBeNull()
    expect(deFechaYHoraLocal('2026-02-30', '09:00')).toBeNull()
  })

  it('minutosEntre y sumarMinutos cruzan la medianoche', () => {
    expect(minutosEntre({ fecha: '2026-12-09', hora: '22:00' }, { fecha: '2026-12-10', hora: '02:00' })).toBe(240)
    expect(minutosEntre({ fecha: '2026-12-09', hora: '10:00' }, { fecha: '2026-12-09', hora: '09:00' })).toBe(-60)
    expect(minutosEntre({ fecha: '', hora: '10:00' }, { fecha: '2026-12-09', hora: '09:00' })).toBeNull()
    expect(sumarMinutos({ fecha: '2026-12-31', hora: '23:30' }, 60)).toEqual({ fecha: '2027-01-01', hora: '00:30' })
    expect(sumarMinutos({ fecha: '2026-12-31', hora: '' }, 60)).toBeNull()
  })

  it('esDeDiasCompletos: de 00:00 a 00:00 locales, uno o varios días', () => {
    expect(esDeDiasCompletos('2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00')).toBe(true)
    expect(esDeDiasCompletos('2026-12-02T00:00:00-03:00', '2026-12-05T00:00:00-03:00')).toBe(true)
    expect(esDeDiasCompletos('2026-12-08T00:00:00-03:00', '2026-12-08T12:00:00-03:00')).toBe(false)
    expect(esDeDiasCompletos('2026-12-02T09:00:00-03:00', '2026-12-04T18:00:00-03:00')).toBe(false)
    // Mismo instante escrito en UTC: 03:00Z = 00:00 en Buenos Aires.
    expect(esDeDiasCompletos('2026-12-08T03:00:00Z', '2026-12-09T03:00:00Z')).toBe(true)
    // 00:00 en UTC no es 00:00 local.
    expect(esDeDiasCompletos('2026-12-08T00:00:00Z', '2026-12-09T00:00:00Z')).toBe(false)
  })
})

describe('formatearRangoEvento y mensajes de eventos', () => {
  it.each([
    ['2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00', 'mar 15 dic, 09:00–10:00'],
    ['2026-12-15T22:00:00-03:00', '2026-12-16T00:00:00-03:00', 'mar 15 dic, 22:00–00:00'],
    ['2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00', 'mar 8 dic, todo el día'],
    ['2026-12-02T00:00:00-03:00', '2026-12-05T00:00:00-03:00', 'del mié 2 dic al vie 4 dic'],
    ['2026-12-09T22:00:00-03:00', '2026-12-10T02:00:00-03:00', 'del mié 9 dic, 22:00 al jue 10 dic, 02:00'],
  ])('%s → %s = «%s»', (inicio, fin, texto) => {
    expect(formatearRangoEvento(inicio, fin)).toBe(texto)
  })

  it('nunca escribe «24:00»', () => {
    expect(formatearRangoEvento('2026-12-15T23:00:00-03:00', '2026-12-16T00:00:00-03:00')).not.toContain('24:00')
  })

  it('mensajes', () => {
    expect(mensajeEventoCreado('Dentista', '2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')).toBe(
      'Evento «Dentista» creado (mar 15 dic, 09:00–10:00)',
    )
    expect(mensajeEventoGuardado('Feriado', '2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00')).toBe(
      'Evento «Feriado» guardado (mar 8 dic, todo el día)',
    )
    expect(mensajeEventoBorrado('Dentista', false)).toBe('Evento «Dentista» borrado')
    expect(mensajeEventoBorrado('Dentista', true)).toBe('Evento «Dentista» borrado, con su recordatorio')
    expect(mensajeEventoYaNoExistia('Dentista')).toBe('El evento «Dentista» ya no existía')
    expect(mensajeEventoEmpieza('2026-12-15T09:00:00-03:00', '2026-12-15T10:00:00-03:00')).toBe('El evento empieza el mar 15 dic · 09:00')
    expect(mensajeEventoEmpieza('2026-12-15T00:00:00-03:00', '2026-12-16T00:00:00-03:00')).toBe('El evento es mar 15 dic, todo el día')
  })
})
