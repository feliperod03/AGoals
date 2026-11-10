import { describe, expect, it } from 'vitest'

import { idea } from './fabrica'
import { aRequestIdea, conclusionEditable, valoresIniciales, type ValoresIdea } from './formulario'

const valores = (parcial: Partial<ValoresIdea> = {}): ValoresIdea => ({
  titulo: 'Cantar',
  descripcion: '',
  tipoVinculo: 'ninguno',
  vinculoId: null,
  conclusion: '',
  ...parcial,
})

describe('valoresIniciales', () => {
  it('una idea nueva empieza vacía y suelta', () => {
    expect(valoresIniciales()).toEqual({ titulo: '', descripcion: '', tipoVinculo: 'ninguno', vinculoId: null, conclusion: '' })
  })

  it('toma el vínculo de la idea: proyecto, objetivo o ninguno', () => {
    expect(valoresIniciales(idea({ proyectoId: 4 }))).toMatchObject({ tipoVinculo: 'proyecto', vinculoId: 4 })
    expect(valoresIniciales(idea({ objetivoId: 9 }))).toMatchObject({ tipoVinculo: 'objetivo', vinculoId: 9 })
    expect(valoresIniciales(idea())).toMatchObject({ tipoVinculo: 'ninguno', vinculoId: null })
  })

  it('null se vuelve texto vacío en el formulario', () => {
    expect(valoresIniciales(idea({ descripcion: null, conclusion: null }))).toMatchObject({ descripcion: '', conclusion: '' })
  })
})

describe('conclusionEditable', () => {
  it('solo con conclusión previa o idea concluida', () => {
    expect(conclusionEditable(undefined)).toBe(false)
    expect(conclusionEditable(idea())).toBe(false)
    expect(conclusionEditable(idea({ conclusion: 'Algo' }))).toBe(true)
    expect(conclusionEditable(idea({ estado: 'CONCLUIDA' }))).toBe(true)
  })
})

describe('aRequestIdea', () => {
  it('manda siempre los cinco campos, con null donde no hay valor', () => {
    expect(aRequestIdea(valores({ titulo: '  Cantar  ', descripcion: '  ' }))).toEqual({
      titulo: 'Cantar',
      descripcion: null,
      proyectoId: null,
      objetivoId: null,
      conclusion: null,
    })
  })

  it('nunca manda proyecto y objetivo a la vez, aunque el id sobreviva a un cambio de tipo', () => {
    expect(aRequestIdea(valores({ tipoVinculo: 'proyecto', vinculoId: 3 }))).toMatchObject({ proyectoId: 3, objetivoId: null })
    expect(aRequestIdea(valores({ tipoVinculo: 'objetivo', vinculoId: 3 }))).toMatchObject({ proyectoId: null, objetivoId: 3 })
    expect(aRequestIdea(valores({ tipoVinculo: 'ninguno', vinculoId: 3 }))).toMatchObject({ proyectoId: null, objetivoId: null })
  })

  it('una idea reabierta conserva su conclusión aunque el formulario no se toque', () => {
    const reabierta = idea({ id: 5, titulo: 'Cantar', conclusion: 'Salió bien', estado: 'PLANTEADA' })
    expect(aRequestIdea(valoresIniciales(reabierta), reabierta)).toEqual({
      titulo: 'Cantar',
      descripcion: null,
      proyectoId: null,
      objetivoId: null,
      conclusion: 'Salió bien',
    })
  })

  it('con el campo editable, vaciarlo borra la conclusión (null)', () => {
    const concluida = idea({ estado: 'CONCLUIDA', conclusion: 'Vieja' })
    expect(aRequestIdea(valores({ conclusion: '   ' }), concluida).conclusion).toBeNull()
  })

  it('sin conclusión previa, el campo oculto manda null', () => {
    expect(aRequestIdea(valores({ conclusion: 'basura' }), idea())).toMatchObject({ conclusion: null })
  })
})
