import { describe, expect, it } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Estado, Prioridad, Tarea } from '@/types/tarea'
import {
  diaDestino,
  diaDestinoSemana,
  diasDeLaCuadricula,
  esDeFranja,
  lineasDeTitulo,
  rangoDeLaSemana,
  repartirDia,
  semanaDesdeUrl,
  textoHoraBloque,
  tipoYHoraParaLector,
  tituloDeBloque,
  vistaDesdeUrl,
  type ElementoConHora,
  elementosPorDia,
  estadoDesdeUrl,
  etiquetaDia,
  ordenarElementos,
  recortarParaCelda,
  textoHora,
  textoHoraCelda,
  type ElementoDia,
} from './calendario'

let siguienteId = 1

function tarea(extra: Partial<Tarea> = {}): Tarea {
  return {
    id: siguienteId++,
    titulo: 'Tarea',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: '2026-11-10',
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...extra,
  }
}

function evento(inicio: string, fin: string, extra: Partial<Evento> = {}): Evento {
  return { id: siguienteId++, titulo: 'Evento', descripcion: null, fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null, ...extra }
}

const DIAS = ['2026-11-09', '2026-11-10', '2026-11-11']

describe('elementosPorDia', () => {
  it('una tarea sin fecha no aparece', () => {
    const mapa = elementosPorDia(DIAS, [], [tarea({ fecha: null })])
    expect([...mapa.values()].flat()).toHaveLength(0)
  })

  it('una tarea fuera de los días pedidos no aparece', () => {
    const mapa = elementosPorDia(DIAS, [], [tarea({ fecha: '2026-12-01' })])
    expect([...mapa.values()].flat()).toHaveLength(0)
  })

  it('las CANCELADAS no aparecen y las HECHAS sí', () => {
    const mapa = elementosPorDia(DIAS, [], [tarea({ estado: 'CANCELADO' }), tarea({ estado: 'HECHO', titulo: 'Hecha' })])
    const del10 = mapa.get('2026-11-10') ?? []
    expect(del10).toHaveLength(1)
    expect(del10[0]).toMatchObject({ tipo: 'tarea', titulo: 'Hecha', estado: 'HECHO' })
  })

  it('todos los días pedidos existen en el mapa, aunque estén vacíos', () => {
    const mapa = elementosPorDia(DIAS, [], [])
    expect([...mapa.keys()]).toEqual(DIAS)
  })

  it('un evento de varios días aparece en cada día que toca, con su tramo', () => {
    const e = evento('2026-11-09T22:00:00-03:00', '2026-11-11T02:00:00-03:00')
    const mapa = elementosPorDia(DIAS, [e], [])
    expect(mapa.get('2026-11-09')?.[0]).toMatchObject({ inicioMin: 1320, finMin: 1440, empiezaAntes: false, terminaDespues: true })
    expect(mapa.get('2026-11-10')?.[0]).toMatchObject({ inicioMin: 0, finMin: 1440, empiezaAntes: true, terminaDespues: true })
    expect(mapa.get('2026-11-11')?.[0]).toMatchObject({ inicioMin: 0, finMin: 120, empiezaAntes: true, terminaDespues: false })
  })

  it('un evento que cruza el fin de mes aparece en los dos meses dentro de la cuadrícula', () => {
    const dias = diasDeLaCuadricula('2026-11')
    const e = evento('2026-11-30T20:00:00-03:00', '2026-12-01T10:00:00-03:00')
    const mapa = elementosPorDia(dias, [e], [])
    expect(mapa.get('2026-11-30')).toHaveLength(1)
    expect(mapa.get('2026-12-01')).toHaveLength(1)
    expect(mapa.get('2026-11-29')).toHaveLength(0)
  })

  it('una tarea con hora de inicio y sin fin dura 30 minutos', () => {
    const mapa = elementosPorDia(DIAS, [], [tarea({ horaInicio: '09:00:00' })])
    expect(mapa.get('2026-11-10')?.[0]).toMatchObject({ inicioMin: 540, finMin: 570 })
  })

  it('cada día sale ya ordenado', () => {
    const mapa = elementosPorDia(
      DIAS,
      [evento('2026-11-10T11:00:00-03:00', '2026-11-10T12:00:00-03:00', { titulo: 'Tarde' })],
      [tarea({ titulo: 'Sin hora' }), tarea({ titulo: 'Temprano', horaInicio: '08:00:00' })],
    )
    expect(mapa.get('2026-11-10')?.map((e) => e.titulo)).toEqual(['Temprano', 'Tarde', 'Sin hora'])
  })
})

function elemento(extra: { tipo: 'tarea'; titulo?: string; inicioMin?: number | null; prioridad?: Prioridad | null; id?: number; estado?: Estado }): ElementoDia
function elemento(extra: { tipo: 'evento'; titulo?: string; inicioMin?: number }): ElementoDia
function elemento(extra: {
  tipo: 'tarea' | 'evento'
  titulo?: string
  inicioMin?: number | null
  prioridad?: Prioridad | null
  id?: number
  estado?: Estado
}): ElementoDia {
  const titulo = extra.titulo ?? 'X'
  if (extra.tipo === 'evento') {
    const inicioMin = extra.inicioMin ?? 600
    return {
      clave: `e-${titulo}`,
      tipo: 'evento',
      titulo,
      inicioMin,
      finMin: inicioMin + 60,
      empiezaAntes: false,
      terminaDespues: false,
      prioridad: null,
      evento: evento('2026-11-10T10:00:00-03:00', '2026-11-10T11:00:00-03:00'),
    }
  }
  const inicioMin = extra.inicioMin === undefined ? null : extra.inicioMin
  return {
    clave: `t-${titulo}`,
    tipo: 'tarea',
    titulo,
    inicioMin,
    finMin: inicioMin === null ? null : Math.min(inicioMin + 30, 1440),
    estado: extra.estado ?? 'PENDIENTE',
    prioridad: extra.prioridad ?? null,
    tarea: tarea({ id: extra.id ?? 1, titulo, prioridad: extra.prioridad ?? null }),
  }
}

describe('ordenarElementos', () => {
  const ordenar = (lista: ElementoDia[]) => [...lista].sort(ordenarElementos).map((e) => e.titulo)

  it('lo que tiene hora va antes que lo que no', () => {
    expect(ordenar([elemento({ tipo: 'tarea', titulo: 'sin' }), elemento({ tipo: 'tarea', titulo: 'con', inicioMin: 900 })])).toEqual(['con', 'sin'])
  })

  it('eventos y tareas con hora se mezclan por minuto de inicio', () => {
    expect(
      ordenar([
        elemento({ tipo: 'tarea', titulo: 'a las 10', inicioMin: 600 }),
        elemento({ tipo: 'evento', titulo: 'a las 9', inicioMin: 540 }),
        elemento({ tipo: 'tarea', titulo: 'a las 8', inicioMin: 480 }),
      ]),
    ).toEqual(['a las 8', 'a las 9', 'a las 10'])
  })

  it('a la misma hora, el evento va antes que la tarea y luego por título', () => {
    expect(
      ordenar([
        elemento({ tipo: 'tarea', titulo: 'tarea', inicioMin: 600 }),
        elemento({ tipo: 'evento', titulo: 'B evento', inicioMin: 600 }),
        elemento({ tipo: 'evento', titulo: 'A evento', inicioMin: 600 }),
      ]),
    ).toEqual(['A evento', 'B evento', 'tarea'])
  })

  it('las tareas sin hora van por prioridad y luego por id', () => {
    expect(
      ordenar([
        elemento({ tipo: 'tarea', titulo: 'sin prioridad', prioridad: null, id: 1 }),
        elemento({ tipo: 'tarea', titulo: 'baja', prioridad: 'BAJA', id: 2 }),
        elemento({ tipo: 'tarea', titulo: 'alta 9', prioridad: 'ALTA', id: 9 }),
        elemento({ tipo: 'tarea', titulo: 'alta 3', prioridad: 'ALTA', id: 3 }),
        elemento({ tipo: 'tarea', titulo: 'media', prioridad: 'MEDIA', id: 4 }),
      ]),
    ).toEqual(['alta 3', 'alta 9', 'media', 'baja', 'sin prioridad'])
  })

  it('la continuación de un evento de ayer (empieza en 0) va primero', () => {
    expect(
      ordenar([
        elemento({ tipo: 'tarea', titulo: 'tarea', inicioMin: 60 }),
        elemento({ tipo: 'evento', titulo: 'continuación', inicioMin: 0 }),
      ]),
    ).toEqual(['continuación', 'tarea'])
  })
})

describe('recortarParaCelda', () => {
  const lista = (n: number) => Array.from({ length: n }, (_, i) => elemento({ tipo: 'tarea', titulo: `t${i}`, id: i }))

  it('vacío', () => {
    expect(recortarParaCelda([])).toEqual({ visibles: [], ocultos: 0 })
  })

  it('3 elementos caben todos', () => {
    const r = recortarParaCelda(lista(3))
    expect(r.visibles).toHaveLength(3)
    expect(r.ocultos).toBe(0)
  })

  it('4 elementos: 2 visibles y 2 ocultos', () => {
    const r = recortarParaCelda(lista(4))
    expect(r.visibles.map((e) => e.titulo)).toEqual(['t0', 't1'])
    expect(r.ocultos).toBe(2)
  })

  it('con otro máximo', () => {
    expect(recortarParaCelda(lista(5), 2)).toMatchObject({ ocultos: 4 })
    expect(recortarParaCelda(lista(5), 2).visibles).toHaveLength(1)
    expect(recortarParaCelda(lista(5), 5).ocultos).toBe(0)
  })
})

describe('textoHora', () => {
  const evt = (extra: Partial<Extract<ElementoDia, { tipo: 'evento' }>>): ElementoDia => ({
    ...(elemento({ tipo: 'evento' }) as Extract<ElementoDia, { tipo: 'evento' }>),
    ...extra,
  })

  it('tarea sin hora: null', () => {
    expect(textoHora(elemento({ tipo: 'tarea' }))).toBeNull()
  })

  it('tarea con hora: inicio–fin (30 minutos por defecto)', () => {
    expect(textoHora(elemento({ tipo: 'tarea', inicioMin: 570 }))).toBe('09:30–10:00')
  })

  it('una tarea que termina a las 24:00 se escribe 00:00', () => {
    expect(textoHora(elemento({ tipo: 'tarea', inicioMin: 1425 }))).toBe('23:45–00:00')
  })

  it('evento normal', () => {
    expect(textoHora(evt({ inicioMin: 540, finMin: 630 }))).toBe('09:00–10:30')
  })

  it('primer día de uno que sigue al día siguiente: desde 22:00 (no 22:00–00:00)', () => {
    const texto = textoHora(evt({ inicioMin: 1320, finMin: 1440, terminaDespues: true }))
    expect(texto).toBe('desde 22:00')
    expect(texto).not.toContain('24:00')
  })

  it('un evento que termina justo a medianoche conserva 22:00–00:00, nunca 24:00', () => {
    const texto = textoHora(evt({ inicioMin: 1320, finMin: 1440, terminaDespues: false }))
    expect(texto).toBe('22:00–00:00')
    expect(texto).not.toContain('24:00')
  })

  it('día intermedio: Todo el día', () => {
    expect(textoHora(evt({ inicioMin: 0, finMin: 1440, empiezaAntes: true, terminaDespues: true }))).toBe('Todo el día')
  })

  it('último día: hasta 02:00', () => {
    expect(textoHora(evt({ inicioMin: 0, finMin: 120, empiezaAntes: true }))).toBe('hasta 02:00')
  })
})

describe('etiquetaDia', () => {
  it('día vacío', () => {
    expect(etiquetaDia('2026-11-12', [], '2026-11-10')).toBe('jueves 12 de noviembre, sin elementos')
  })

  it('marca hoy y cuenta en singular y plural', () => {
    const lista = [
      elemento({ tipo: 'evento', titulo: 'a' }),
      elemento({ tipo: 'evento', titulo: 'b' }),
      elemento({ tipo: 'tarea', titulo: 'c' }),
    ]
    expect(etiquetaDia('2026-11-10', lista, '2026-11-10')).toBe('martes 10 de noviembre, hoy, 2 eventos, 1 tarea')
  })

  it('3 tareas en plural, sin eventos', () => {
    const lista = [1, 2, 3].map((id) => elemento({ tipo: 'tarea', titulo: `t${id}`, id }))
    expect(etiquetaDia('2026-11-11', lista, '2026-11-10')).toBe('miércoles 11 de noviembre, 3 tareas')
  })

  it('no cuenta las tareas CANCELADAS y sí las HECHAS', () => {
    const lista = [
      elemento({ tipo: 'tarea', titulo: 'hecha', estado: 'HECHO' }),
      elemento({ tipo: 'tarea', titulo: 'cancelada', estado: 'CANCELADO' }),
    ]
    expect(etiquetaDia('2026-11-10', lista, '2026-11-01')).toBe('martes 10 de noviembre, 1 tarea')
  })
})

describe('estadoDesdeUrl', () => {
  const HOY = '2026-11-10'

  it('sin parámetros: el mes de hoy y hoy', () => {
    expect(estadoDesdeUrl(null, null, HOY)).toEqual({ mes: '2026-11', dia: HOY })
  })

  it('otro mes sin día: el día 1', () => {
    expect(estadoDesdeUrl('2027-02', null, HOY)).toEqual({ mes: '2027-02', dia: '2027-02-01' })
  })

  it('mes inválido: cae al mes de hoy', () => {
    expect(estadoDesdeUrl('2026-13', null, HOY)).toEqual({ mes: '2026-11', dia: HOY })
    expect(estadoDesdeUrl('abc', null, HOY)).toEqual({ mes: '2026-11', dia: HOY })
  })

  it('día inválido o inexistente: la selección por defecto', () => {
    expect(estadoDesdeUrl('2026-11', '2026-02-30', HOY).dia).toBe(HOY)
    expect(estadoDesdeUrl('2026-11', 'xx', HOY).dia).toBe(HOY)
  })

  it('día fuera de la cuadrícula visible: la selección por defecto', () => {
    expect(estadoDesdeUrl('2026-11', '2027-03-15', HOY).dia).toBe(HOY)
    expect(estadoDesdeUrl('2027-02', '2026-11-10', HOY).dia).toBe('2027-02-01')
  })

  it('día de un mes vecino que sí está en la cuadrícula: se respeta', () => {
    expect(estadoDesdeUrl('2026-11', '2026-10-28', HOY).dia).toBe('2026-10-28')
    expect(estadoDesdeUrl('2026-11', '2026-12-03', HOY).dia).toBe('2026-12-03')
  })

  it('día del propio mes: se respeta', () => {
    expect(estadoDesdeUrl('2026-11', '2026-11-20', HOY)).toEqual({ mes: '2026-11', dia: '2026-11-20' })
  })
})

describe('diaDestino', () => {
  it('flechas: un día y una semana', () => {
    expect(diaDestino('2026-11-10', 'ArrowLeft')).toBe('2026-11-09')
    expect(diaDestino('2026-11-10', 'ArrowRight')).toBe('2026-11-11')
    expect(diaDestino('2026-11-10', 'ArrowUp')).toBe('2026-11-03')
    expect(diaDestino('2026-11-10', 'ArrowDown')).toBe('2026-11-17')
  })

  it('Inicio y Fin: lunes y domingo de esa semana', () => {
    expect(diaDestino('2026-11-10', 'Home')).toBe('2026-11-09')
    expect(diaDestino('2026-11-10', 'End')).toBe('2026-11-15')
    expect(diaDestino('2026-11-15', 'Home')).toBe('2026-11-09')
  })

  it('RePág y AvPág: mes anterior y siguiente, acotado', () => {
    expect(diaDestino('2026-11-10', 'PageUp')).toBe('2026-10-10')
    expect(diaDestino('2026-11-10', 'PageDown')).toBe('2026-12-10')
    expect(diaDestino('2026-01-31', 'PageDown')).toBe('2026-02-28')
  })

  it('cruza mes y año', () => {
    expect(diaDestino('2026-11-30', 'ArrowDown')).toBe('2026-12-07')
    expect(diaDestino('2026-12-31', 'ArrowRight')).toBe('2027-01-01')
    expect(diaDestino('2027-01-01', 'ArrowLeft')).toBe('2026-12-31')
    expect(diaDestino('2026-12-15', 'PageDown')).toBe('2027-01-15')
  })

  it('una tecla ajena no mueve', () => {
    expect(diaDestino('2026-11-10', 'a')).toBeNull()
    expect(diaDestino('2026-11-10', 'Enter')).toBeNull()
  })
})

describe('textoHoraCelda', () => {
  const evt = (extra: Partial<Extract<ElementoDia, { tipo: 'evento' }>>): ElementoDia => ({
    ...(elemento({ tipo: 'evento' }) as Extract<ElementoDia, { tipo: 'evento' }>),
    ...extra,
  })

  it('solo la hora de inicio, o nada si la tarea no tiene hora', () => {
    expect(textoHoraCelda(elemento({ tipo: 'tarea' }))).toBeNull()
    expect(textoHoraCelda(elemento({ tipo: 'tarea', inicioMin: 570 }))).toBe('09:30')
    expect(textoHoraCelda(evt({ inicioMin: 1320, finMin: 1440, terminaDespues: true }))).toBe('22:00')
  })

  it('días intermedio y último de un evento largo: sin hora (va en el title y en el panel)', () => {
    expect(textoHoraCelda(evt({ inicioMin: 0, finMin: 1440, empiezaAntes: true, terminaDespues: true }))).toBeNull()
    expect(textoHoraCelda(evt({ inicioMin: 0, finMin: 120, empiezaAntes: true }))).toBeNull()
  })
})

// --- Vista semanal (9b) ---

const SEMANA = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13']

describe('textoHora: tramo de un día entero', () => {
  it('un evento de 00:00 a 00:00 del día siguiente dice «Todo el día», no «00:00–00:00»', () => {
    const e = evento('2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00')
    const [elemento] = elementosPorDia(SEMANA, [e], []).get('2026-12-08') ?? []
    expect(textoHora(elemento as ElementoDia)).toBe('Todo el día')
  })
})

describe('vistaDesdeUrl / semanaDesdeUrl', () => {
  it('solo «semana» elige la semana; lo demás es el mes', () => {
    expect(vistaDesdeUrl('semana')).toBe('semana')
    expect(vistaDesdeUrl('mes')).toBe('mes')
    expect(vistaDesdeUrl(null)).toBe('mes')
    expect(vistaDesdeUrl('Semana')).toBe('mes')
    expect(vistaDesdeUrl('xyz')).toBe('mes')
  })

  it('un día válido da su semana de lunes a domingo', () => {
    expect(semanaDesdeUrl('2026-12-10', '2026-11-10')).toEqual({ dia: '2026-12-10', dias: SEMANA })
  })

  it('un día inválido o ausente cae a hoy', () => {
    for (const valor of [null, '', '2026-02-30', 'abc', '2026-12-1']) {
      const { dia, dias } = semanaDesdeUrl(valor, '2026-11-10')
      expect(dia).toBe('2026-11-10')
      expect(dias[0]).toBe('2026-11-09')
    }
  })
})

describe('diaDestinoSemana', () => {
  it('flechas ±1 día, Inicio y Fin = lunes y domingo, RePág y AvPág ±1 semana', () => {
    expect(diaDestinoSemana('2026-12-10', 'ArrowLeft')).toBe('2026-12-09')
    expect(diaDestinoSemana('2026-12-10', 'ArrowRight')).toBe('2026-12-11')
    expect(diaDestinoSemana('2026-12-10', 'Home')).toBe('2026-12-07')
    expect(diaDestinoSemana('2026-12-10', 'End')).toBe('2026-12-13')
    expect(diaDestinoSemana('2026-12-10', 'PageUp')).toBe('2026-12-03')
    expect(diaDestinoSemana('2026-12-10', 'PageDown')).toBe('2026-12-17')
  })

  it('las flechas salen de la semana por el lunes y el domingo; ↑ ↓ y otras teclas no mueven', () => {
    expect(diaDestinoSemana('2026-12-07', 'ArrowLeft')).toBe('2026-12-06')
    expect(diaDestinoSemana('2026-12-13', 'ArrowRight')).toBe('2026-12-14')
    expect(diaDestinoSemana('2026-12-31', 'ArrowRight')).toBe('2027-01-01')
    expect(diaDestinoSemana('2026-12-10', 'ArrowUp')).toBeNull()
    expect(diaDestinoSemana('2026-12-10', 'ArrowDown')).toBeNull()
    expect(diaDestinoSemana('2026-12-10', 'a')).toBeNull()
  })
})

describe('repartirDia / esDeFranja', () => {
  const del = (mapa: Map<string, ElementoDia[]>, dia: string) => repartirDia(mapa.get(dia) ?? [])

  it('una tarea sin hora va a la franja y una con hora a la línea de tiempo', () => {
    const mapa = elementosPorDia(SEMANA, [], [
      tarea({ fecha: '2026-12-08', titulo: 'Sin hora' }),
      tarea({ fecha: '2026-12-08', titulo: 'Con hora', horaInicio: '14:00:00', horaFin: '15:00:00' }),
    ])
    const { sinHora, conHora } = del(mapa, '2026-12-08')
    expect(sinHora.map((e) => e.titulo)).toEqual(['Sin hora'])
    expect(conHora.map((e) => e.titulo)).toEqual(['Con hora'])
  })

  it('un evento de menos de 24 h que cruza la medianoche va a la línea de tiempo en los dos días', () => {
    const guardia = evento('2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00')
    const mapa = elementosPorDia(SEMANA, [guardia], [])
    expect(del(mapa, '2026-12-09').conHora[0]).toMatchObject({ inicioMin: 1320, finMin: 1440, terminaDespues: true })
    expect(del(mapa, '2026-12-10').conHora[0]).toMatchObject({ inicioMin: 0, finMin: 360, empiezaAntes: true })
    expect(del(mapa, '2026-12-09').sinHora).toHaveLength(0)
  })

  it('un evento de 23 h 59 min sigue en la línea de tiempo; uno de exactamente 24 h va a la franja', () => {
    const casi = evento('2026-12-08T09:00:00-03:00', '2026-12-09T08:59:00-03:00')
    const justo = evento('2026-12-11T09:00:00-03:00', '2026-12-12T09:00:00-03:00')
    const mapa = elementosPorDia(SEMANA, [casi, justo], [])
    expect(del(mapa, '2026-12-08').conHora).toHaveLength(1)
    expect(del(mapa, '2026-12-11').sinHora).toHaveLength(1)
    expect(del(mapa, '2026-12-12').sinHora).toHaveLength(1)
    expect(del(mapa, '2026-12-12').conHora).toHaveLength(0)
  })

  it('un evento de tres días va a la franja en los tres', () => {
    const congreso = evento('2026-12-08T09:00:00-03:00', '2026-12-10T18:00:00-03:00')
    const mapa = elementosPorDia(SEMANA, [congreso], [])
    for (const dia of ['2026-12-08', '2026-12-09', '2026-12-10']) {
      expect(del(mapa, dia).sinHora).toHaveLength(1)
      expect(del(mapa, dia).conHora).toHaveLength(0)
    }
    const [primero] = mapa.get('2026-12-08') ?? []
    expect(esDeFranja(primero as ElementoDia)).toBe(true)
  })

  it('las HECHAS se quedan y las CANCELADAS no llegan', () => {
    const mapa = elementosPorDia(SEMANA, [], [
      tarea({ fecha: '2026-12-08', estado: 'HECHO' }),
      tarea({ fecha: '2026-12-08', estado: 'CANCELADO' }),
    ])
    expect(del(mapa, '2026-12-08').sinHora.map((e) => e.tipo === 'tarea' && e.estado)).toEqual(['HECHO'])
  })

  it('conserva el orden del día en cada parte', () => {
    const mapa = elementosPorDia(SEMANA, [evento('2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00', { titulo: 'B' })], [
      tarea({ fecha: '2026-12-08', titulo: 'A', horaInicio: '08:00:00' }),
      tarea({ fecha: '2026-12-08', titulo: 'C', horaInicio: '11:00:00' }),
    ])
    expect(del(mapa, '2026-12-08').conHora.map((e) => e.titulo)).toEqual(['A', 'B', 'C'])
  })
})

describe('rangoDeLaSemana', () => {
  const conHora = (mapa: Map<string, ElementoDia[]>) => SEMANA.map((d) => repartirDia(mapa.get(d) ?? []).conHora)

  it('sin nada con hora: 08–21', () => {
    expect(rangoDeLaSemana(conHora(elementosPorDia(SEMANA, [], [tarea({ fecha: '2026-12-08' })])))).toEqual({ inicioHora: 8, finHora: 21 })
  })

  it('una tarea a las 07:30 lo abre a las 07; una guardia nocturna lo lleva a 00–24', () => {
    expect(rangoDeLaSemana(conHora(elementosPorDia(SEMANA, [], [tarea({ fecha: '2026-12-08', horaInicio: '07:30:00' })])))).toEqual({
      inicioHora: 7,
      finHora: 21,
    })
    const guardia = evento('2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00')
    expect(rangoDeLaSemana(conHora(elementosPorDia(SEMANA, [guardia], [])))).toEqual({ inicioHora: 0, finHora: 24 })
  })

  it('un evento largo (franja) no estira el rango', () => {
    const congreso = evento('2026-12-08T09:00:00-03:00', '2026-12-10T18:00:00-03:00')
    expect(rangoDeLaSemana(conHora(elementosPorDia(SEMANA, [congreso], [])))).toEqual({ inicioHora: 8, finHora: 21 })
  })
})

describe('textos de los bloques de la semana', () => {
  const unDia = (eventos: Evento[], tareas: Tarea[], dia: string) => elementosPorDia(SEMANA, eventos, tareas).get(dia) ?? []

  it('para lectores: tipo y hora completa, o «sin hora»', () => {
    const [ev] = unDia([evento('2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')], [], '2026-12-08')
    const [ta] = unDia([], [tarea({ fecha: '2026-12-08' })], '2026-12-08')
    expect(tipoYHoraParaLector(ev as ElementoDia)).toBe('Evento, 09:00–10:00')
    expect(tipoYHoraParaLector(ta as ElementoDia)).toBe('Tarea, sin hora')
  })

  it('title: tipo en mayúsculas, hora y título', () => {
    const [ev] = unDia([evento('2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00', { titulo: 'Guardia' })], [], '2026-12-10')
    const [ta] = unDia([], [tarea({ fecha: '2026-12-08', titulo: 'Pagar' })], '2026-12-08')
    expect(tituloDeBloque(ev as ElementoDia)).toBe('EVENTO · hasta 06:00 — Guardia')
    expect(tituloDeBloque(ta as ElementoDia)).toBe('TAREA — Pagar')
  })

  it('hora corta: inicio, «desde» el primer día y «hasta» el siguiente', () => {
    const guardia = evento('2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00')
    const mapa = elementosPorDia(SEMANA, [guardia], [tarea({ fecha: '2026-12-08', horaInicio: '09:30:00' })])
    const primero = (dia: string) => repartirDia(mapa.get(dia) ?? []).conHora[0] as ElementoConHora
    expect(textoHoraBloque(primero('2026-12-08'))).toBe('09:30')
    expect(textoHoraBloque(primero('2026-12-09'))).toBe('desde 22:00')
    expect(textoHoraBloque(primero('2026-12-10'))).toBe('hasta 06:00')
  })

  it('lineasDeTitulo: al menos una; resta la línea de la hora', () => {
    expect(lineasDeTitulo(24, false)).toBe(1)
    expect(lineasDeTitulo(24, true)).toBe(1)
    expect(lineasDeTitulo(48, true)).toBe(1)
    expect(lineasDeTitulo(48, false)).toBe(2)
    expect(lineasDeTitulo(96, true)).toBe(4)
  })
})
