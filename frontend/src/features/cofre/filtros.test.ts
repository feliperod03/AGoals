import { describe, expect, it } from 'vitest'

import { tarea } from './fabrica'
import {
  FILTROS_POR_DEFECTO,
  PRESETS,
  alternarPreset,
  chipsDeFiltros,
  filtrar,
  hayFiltrosActivos,
  ordenar,
  presetActivo,
  presetPorId,
  rangoInvertido,
  textoSinResultados,
  type FiltrosCofre,
  type PresetId,
} from './filtros'

const HOY = '2026-11-10'
const base = (parcial: Partial<FiltrosCofre> = {}): FiltrosCofre => ({ ...FILTROS_POR_DEFECTO, fecha: 'todas', ...parcial })
const ids = (ts: { id: number }[]) => ts.map((t) => t.id)

describe('filtrar', () => {
  it('la vista por defecto deja las abiertas sin fecha', () => {
    const ts = [
      tarea({ id: 1 }),
      tarea({ id: 2, fecha: HOY }),
      tarea({ id: 3, estado: 'HECHO' }),
      tarea({ id: 4, estado: 'CANCELADO' }),
      tarea({ id: 5, estado: 'EN_PAUSA' }),
    ]
    expect(ids(filtrar(ts, FILTROS_POR_DEFECTO, HOY))).toEqual([1, 5])
  })

  const fechas = [
    tarea({ id: 1, fecha: null }),
    tarea({ id: 2, fecha: '2026-11-01' }),
    tarea({ id: 3, fecha: HOY }),
    tarea({ id: 4, fecha: '2026-11-20' }),
  ]
  it.each([
    ['todas', [1, 2, 3, 4]],
    ['con', [2, 3, 4]],
    ['sin', [1]],
    ['atrasadas', [2]],
    ['futuras', [4]],
  ] as const)('fecha %s', (fecha, esperado) => {
    expect(ids(filtrar(fechas, base({ fecha }), HOY))).toEqual(esperado)
  })

  it('rango: inclusivo, con límites opcionales y sin las tareas sin fecha', () => {
    expect(ids(filtrar(fechas, base({ fecha: 'rango', desde: '2026-11-10', hasta: '2026-11-20' }), HOY))).toEqual([3, 4])
    expect(ids(filtrar(fechas, base({ fecha: 'rango', desde: '2026-11-10' }), HOY))).toEqual([3, 4])
    expect(ids(filtrar(fechas, base({ fecha: 'rango', hasta: '2026-11-01' }), HOY))).toEqual([2])
    expect(ids(filtrar(fechas, base({ fecha: 'rango' }), HOY))).toEqual([2, 3, 4])
  })

  it('rangoInvertido avisa solo con rango y desde posterior a hasta', () => {
    expect(rangoInvertido(base({ fecha: 'rango', desde: '2026-11-20', hasta: '2026-11-10' }))).toBe(true)
    expect(rangoInvertido(base({ fecha: 'rango', desde: '2026-11-10', hasta: '2026-11-10' }))).toBe(false)
    expect(rangoInvertido(base({ fecha: 'rango', desde: '2026-11-20' }))).toBe(false)
    expect(rangoInvertido(base({ desde: '2026-11-20', hasta: '2026-11-10' }))).toBe(false)
  })

  it('estado: abiertas, uno concreto o todas', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, estado: 'HECHO' }), tarea({ id: 3, estado: 'EN_PROGRESO' }), tarea({ id: 4, estado: 'CANCELADO' })]
    expect(ids(filtrar(ts, base({ estado: 'abiertas' }), HOY))).toEqual([1, 3])
    expect(ids(filtrar(ts, base({ estado: 'HECHO' }), HOY))).toEqual([2])
    expect(ids(filtrar(ts, base({ estado: 'CANCELADO' }), HOY))).toEqual([4])
    expect(ids(filtrar(ts, base({ estado: 'todas' }), HOY))).toEqual([1, 2, 3, 4])
  })

  it('prioridad: una concreta o ninguna', () => {
    const ts = [tarea({ id: 1, prioridad: 'ALTA' }), tarea({ id: 2, prioridad: 'BAJA' }), tarea({ id: 3 })]
    expect(ids(filtrar(ts, base({ prioridad: 'ALTA' }), HOY))).toEqual([1])
    expect(ids(filtrar(ts, base({ prioridad: 'ninguna' }), HOY))).toEqual([3])
    expect(ids(filtrar(ts, base({ prioridad: 'cualquiera' }), HOY))).toEqual([1, 2, 3])
  })

  it('vínculo: suelta, uno concreto o cualquiera de un tipo (solo el vínculo directo)', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, proyectoId: 7 }), tarea({ id: 3, objetivoId: 9 }), tarea({ id: 4, proyectoId: 8 })]
    expect(ids(filtrar(ts, base({ vinculo: { tipo: 'suelta' } }), HOY))).toEqual([1])
    expect(ids(filtrar(ts, base({ vinculo: { tipo: 'proyecto', id: 7 } }), HOY))).toEqual([2])
    expect(ids(filtrar(ts, base({ vinculo: { tipo: 'proyecto', id: null } }), HOY))).toEqual([2, 4])
    expect(ids(filtrar(ts, base({ vinculo: { tipo: 'objetivo', id: null } }), HOY))).toEqual([3])
  })

  it('búsqueda: sin mayúsculas ni tildes, y con espacios alrededor', () => {
    const ts = [tarea({ id: 1, titulo: 'Reunión con Ángela' }), tarea({ id: 2, titulo: 'Comprar pan' })]
    expect(ids(filtrar(ts, base({ busqueda: '  REUNION ' }), HOY))).toEqual([1])
    expect(ids(filtrar(ts, base({ busqueda: 'angela' }), HOY))).toEqual([1])
  })

  it('combina todos los criterios con AND', () => {
    const ts = [
      tarea({ id: 1, prioridad: 'ALTA', proyectoId: 3, titulo: 'Plan' }),
      tarea({ id: 2, prioridad: 'ALTA', titulo: 'Plan' }),
      tarea({ id: 3, prioridad: 'BAJA', proyectoId: 3, titulo: 'Plan' }),
    ]
    const f = base({ prioridad: 'ALTA', vinculo: { tipo: 'proyecto', id: 3 }, busqueda: 'plan' })
    expect(ids(filtrar(ts, f, HOY))).toEqual([1])
  })
})

describe('hayFiltrosActivos', () => {
  it('es falso en la vista por defecto y verdadero al cambiar cualquier cosa', () => {
    expect(hayFiltrosActivos(FILTROS_POR_DEFECTO)).toBe(false)
    expect(hayFiltrosActivos({ ...FILTROS_POR_DEFECTO, busqueda: 'a' })).toBe(true)
  })
})

describe('accesos rápidos', () => {
  it('activar uno cambia solo su dimensión y suma al resto', () => {
    const f = alternarPreset({ ...FILTROS_POR_DEFECTO, busqueda: 'plan', prioridad: 'ALTA' }, presetPorId('atrasadas'))
    expect(f).toEqual({ ...FILTROS_POR_DEFECTO, fecha: 'atrasadas', busqueda: 'plan', prioridad: 'ALTA' })
  })

  it('activar uno de la misma dimensión reemplaza al anterior', () => {
    const f = alternarPreset(alternarPreset(FILTROS_POR_DEFECTO, presetPorId('prioridadAlta')), presetPorId('prioridadMedia'))
    expect(f.prioridad).toBe('MEDIA')
    expect(presetActivo(f, presetPorId('prioridadAlta'))).toBe(false)
    expect(presetActivo(f, presetPorId('prioridadMedia'))).toBe(true)
  })

  it('pulsarlo de nuevo vuelve esa dimensión a neutro, no a la vista por defecto', () => {
    const activo = alternarPreset({ ...FILTROS_POR_DEFECTO, busqueda: 'x' }, presetPorId('futuras'))
    const f = alternarPreset(activo, presetPorId('futuras'))
    expect(f).toEqual({ ...FILTROS_POR_DEFECTO, fecha: 'todas', busqueda: 'x' })
  })

  it('"Sin fecha" está activo en la vista por defecto', () => {
    expect(presetActivo(FILTROS_POR_DEFECTO, presetPorId('sinFecha'))).toBe(true)
  })

  it('cada acceso, al activarse, deja un filtro que reconoce como activo', () => {
    for (const preset of PRESETS) {
      expect(presetActivo(alternarPreset(base(), preset), preset)).toBe(true)
    }
  })

  it('estado: desactivar vuelve a abiertas; sueltas: vuelve a cualquiera', () => {
    const pendientes = alternarPreset(FILTROS_POR_DEFECTO, presetPorId('pendientes'))
    expect(pendientes.estado).toBe('PENDIENTE')
    expect(alternarPreset(pendientes, presetPorId('pendientes')).estado).toBe('abiertas')
    const sueltas = alternarPreset(FILTROS_POR_DEFECTO, presetPorId('sueltas'))
    expect(sueltas.vinculo).toEqual({ tipo: 'suelta' })
    expect(alternarPreset(sueltas, presetPorId('sueltas')).vinculo).toEqual({ tipo: 'cualquiera' })
  })
})

describe('filtros activos y chips', () => {
  const nombres = { proyectos: new Map([[4, 'Mudanza']]), objetivos: new Map<number, string>() }
  const textos = (f: FiltrosCofre, anclados: PresetId[] = []) => chipsDeFiltros(f, anclados, nombres).map((c) => c.texto)

  it('la línea base (todas las fechas, abiertas, sin prioridad ni vínculo) no genera chips; la búsqueda tampoco', () => {
    expect(textos(base())).toEqual([])
    expect(textos(base({ busqueda: 'pan' }))).toEqual([])
  })

  it('la vista por defecto tiene «Sin fecha» como filtro activo', () => {
    expect(textos(FILTROS_POR_DEFECTO)).toEqual(['Sin fecha'])
  })

  it('texto de cada dimensión', () => {
    expect(textos(base({ fecha: 'con' }))).toEqual(['Con fecha'])
    expect(textos(base({ fecha: 'atrasadas' }))).toEqual(['Atrasadas'])
    expect(textos(base({ fecha: 'futuras' }))).toEqual(['Futuras'])
    expect(textos(base({ fecha: 'rango', desde: '2026-11-03', hasta: '2026-11-10' }))).toEqual(['Desde 3 de noviembre hasta 10 de noviembre'])
    expect(textos(base({ fecha: 'rango', desde: '2026-11-03' }))).toEqual(['Desde 3 de noviembre'])
    expect(textos(base({ fecha: 'rango', hasta: '2026-11-10' }))).toEqual(['Hasta 10 de noviembre'])
    expect(textos(base({ fecha: 'rango' }))).toEqual(['Rango de fechas'])
    expect(textos(base({ estado: 'EN_PAUSA' }))).toEqual(['Estado: En pausa'])
    expect(textos(base({ estado: 'todas' }))).toEqual(['Estado: Todas'])
    expect(textos(base({ prioridad: 'MEDIA' }))).toEqual(['Prioridad media'])
    expect(textos(base({ prioridad: 'ninguna' }))).toEqual(['Sin prioridad'])
    expect(textos(base({ vinculo: { tipo: 'suelta' } }))).toEqual(['Suelta'])
    expect(textos(base({ vinculo: { tipo: 'proyecto', id: null } }))).toEqual(['De un proyecto'])
    expect(textos(base({ vinculo: { tipo: 'proyecto', id: 4 } }))).toEqual(['Proyecto: «Mudanza»'])
    expect(textos(base({ vinculo: { tipo: 'objetivo', id: 9 } }))).toEqual(['Objetivo: «#9»'])
  })

  it('un acceso rápido anclado y encendido cubre su dimensión; apagado o sin anclar, no', () => {
    const f = base({ fecha: 'sin', prioridad: 'ALTA', estado: 'PENDIENTE' })
    expect(textos(f)).toEqual(['Sin fecha', 'Estado: Pendiente', 'Prioridad alta'])
    expect(textos(f, ['sinFecha', 'prioridadAlta'])).toEqual(['Estado: Pendiente'])
    // Anclado pero apagado (la prioridad es media, no alta): el chip sigue.
    expect(textos(base({ prioridad: 'MEDIA' }), ['prioridadAlta'])).toEqual(['Prioridad media'])
  })

  it('la × quita solo su dimensión (fecha limpia también el rango; estado vuelve a abiertas)', () => {
    const f = base({ fecha: 'rango', desde: '2026-11-03', hasta: '2026-11-10', estado: 'HECHO', prioridad: 'ALTA' })
    const quitado = (dim: string) => ({ ...f, ...chipsDeFiltros(f, [], nombres).find((c) => c.dimension === dim)!.quitar })
    expect(quitado('fecha')).toEqual({ ...f, fecha: 'todas', desde: '', hasta: '' })
    expect(quitado('estado').estado).toBe('abiertas')
    expect(quitado('prioridad').prioridad).toBe('cualquiera')
  })

  it('textoSinResultados nombra todos los filtros, incluidos los de accesos rápidos y la búsqueda', () => {
    const f = { ...FILTROS_POR_DEFECTO, prioridad: 'ALTA' as const }
    expect(textoSinResultados(f, nombres)).toBe('No hay tareas con estos filtros: Sin fecha, Prioridad alta.')
    expect(textoSinResultados({ ...FILTROS_POR_DEFECTO, busqueda: ' zzz ' }, nombres)).toBe(
      'No hay tareas con estos filtros: Sin fecha, Título contiene «zzz».',
    )
  })

  it('si solo queda la línea base, no deja una lista vacía tras los dos puntos', () => {
    expect(textoSinResultados(base(), nombres)).toBe('No hay tareas abiertas.')
  })
})

describe('ordenar', () => {
  it('por fecha: las sin fecha van al final en ambos sentidos', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, fecha: '2026-11-20' }), tarea({ id: 3, fecha: '2026-11-05' })]
    expect(ids(ordenar(ts, 'fecha', 'asc'))).toEqual([3, 2, 1])
    expect(ids(ordenar(ts, 'fecha', 'desc'))).toEqual([2, 3, 1])
  })

  it('por prioridad: alta primero en desc; las sin prioridad siempre al final', () => {
    const ts = [tarea({ id: 1 }), tarea({ id: 2, prioridad: 'BAJA' }), tarea({ id: 3, prioridad: 'ALTA' }), tarea({ id: 4, prioridad: 'MEDIA' })]
    expect(ids(ordenar(ts, 'prioridad', 'desc'))).toEqual([3, 4, 2, 1])
    expect(ids(ordenar(ts, 'prioridad', 'asc'))).toEqual([2, 4, 3, 1])
  })

  it('por antigüedad: asc = más antiguas primero', () => {
    const ts = [
      tarea({ id: 1, fechaCreacion: '2026-11-05T10:00:00-03:00' }),
      tarea({ id: 2, fechaCreacion: '2026-10-01T10:00:00-03:00' }),
      tarea({ id: 3, fechaCreacion: '2026-11-09T10:00:00-03:00' }),
    ]
    expect(ids(ordenar(ts, 'antiguedad', 'asc'))).toEqual([2, 1, 3])
    expect(ids(ordenar(ts, 'antiguedad', 'desc'))).toEqual([3, 1, 2])
  })

  it('desempata por id y no modifica el arreglo recibido', () => {
    const ts = [tarea({ id: 3, prioridad: 'ALTA' }), tarea({ id: 1, prioridad: 'ALTA' }), tarea({ id: 2, prioridad: 'ALTA' })]
    expect(ids(ordenar(ts, 'prioridad', 'desc'))).toEqual([1, 2, 3])
    expect(ids(ordenar(ts, 'prioridad', 'asc'))).toEqual([1, 2, 3])
    expect(ids(ts)).toEqual([3, 1, 2])
  })
})
