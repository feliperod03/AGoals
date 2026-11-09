import { describe, expect, it } from 'vitest'

import { candidatosProyectoParaObjetivo } from './candidatosObjetivo'
import { objetivo, proyecto } from './fabrica'

const OBJETIVOS = [objetivo({ id: 1, nombre: 'Salud' }), objetivo({ id: 3, nombre: 'Viajar' })]

describe('candidatosProyectoParaObjetivo', () => {
  const delObjetivo = proyecto({ id: 10, nombre: 'Del objetivo', objetivoId: 1 })
  const cerrado = proyecto({ id: 13, nombre: 'Cerrado', estado: 'HECHO' })
  const proyectos = [
    delObjetivo,
    proyecto({ id: 11, nombre: 'Suelto' }),
    proyecto({ id: 12, nombre: 'De otro', objetivoId: 3 }),
    cerrado,
    proyecto({ id: 14, nombre: 'Cancelado', estado: 'CANCELADO', objetivoId: 3 }),
  ]

  it('excluye los que ya son del objetivo y los cerrados', () => {
    const ids = candidatosProyectoParaObjetivo(1, proyectos, OBJETIVOS).map((c) => c.item.id)
    expect(ids).toEqual([12, 11])
  })

  it('al que no tiene objetivo lo rotula «Sin objetivo» y al de otro avisa que se moverá', () => {
    expect(candidatosProyectoParaObjetivo(1, proyectos, OBJETIVOS).map((c) => [c.texto, c.detalle])).toEqual([
      ['De otro', 'Ahora es del objetivo «Viajar»; se moverá'],
      ['Suelto', 'Sin objetivo'],
    ])
  })

  it('si la lista de objetivos no cargó, nombra el otro objetivo por su número', () => {
    expect(candidatosProyectoParaObjetivo(1, proyectos, undefined).map((c) => c.detalle)).toEqual([
      'Ahora es del objetivo «n.º 3»; se moverá',
      'Sin objetivo',
    ])
  })

  it('ordena por nombre, sin tildes ni mayúsculas', () => {
    const lista = [proyecto({ id: 1, nombre: 'zeta' }), proyecto({ id: 2, nombre: 'Árbol' }), proyecto({ id: 3, nombre: 'Barco' })]
    expect(candidatosProyectoParaObjetivo(9, lista, OBJETIVOS).map((c) => c.texto)).toEqual(['Árbol', 'Barco', 'zeta'])
  })

  it('no hay candidatos si todos son del objetivo o están cerrados', () => {
    expect(candidatosProyectoParaObjetivo(1, [delObjetivo, cerrado], OBJETIVOS)).toEqual([])
  })
})
