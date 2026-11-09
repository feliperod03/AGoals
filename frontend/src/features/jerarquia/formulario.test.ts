import { describe, expect, it } from 'vitest'

import { objetivo, proyecto } from './fabrica'
import { aRequestObjetivo, aRequestProyecto, requestObjetivoDe, requestProyectoDe, valoresIniciales } from './formulario'

const ORIGINAL = proyecto({
  id: 7,
  nombre: 'Mudanza',
  descripcion: 'Todo el piso',
  estado: 'EN_PAUSA',
  prioridad: 'ALTA',
  padreId: 2,
  objetivoId: 5,
})

describe('valoresIniciales', () => {
  it('al crear: vacío y pendiente', () => {
    expect(valoresIniciales()).toEqual({ nombre: '', descripcion: '', estado: 'PENDIENTE', prioridad: '', objetivoId: '' })
  })

  it('al editar copia el elemento; descripción vacía o null y sin prioridad/objetivo quedan en ""', () => {
    expect(valoresIniciales(ORIGINAL)).toEqual({ nombre: 'Mudanza', descripcion: 'Todo el piso', estado: 'EN_PAUSA', prioridad: 'ALTA', objetivoId: '5' })
    expect(valoresIniciales(proyecto({ descripcion: '' }))).toMatchObject({ descripcion: '', prioridad: '', objetivoId: '' })
    expect(valoresIniciales(objetivo({ descripcion: null }))).toMatchObject({ descripcion: '', objetivoId: '' })
  })
})

describe('aRequestProyecto', () => {
  it('al editar reenvía los seis campos: estado, prioridad, padre y objetivo no se pierden', () => {
    expect(aRequestProyecto(valoresIniciales(ORIGINAL), ORIGINAL)).toEqual({
      nombre: 'Mudanza',
      descripcion: 'Todo el piso',
      estado: 'EN_PAUSA',
      prioridad: 'ALTA',
      padreId: 2,
      objetivoId: 5,
    })
  })

  it('padreId: undefined conserva el original, null lo quita y un número lo cambia', () => {
    const valores = valoresIniciales(ORIGINAL)
    expect(aRequestProyecto(valores, ORIGINAL, undefined).padreId).toBe(2)
    expect(aRequestProyecto(valores, ORIGINAL, null).padreId).toBeNull()
    expect(aRequestProyecto(valores, ORIGINAL, 9).padreId).toBe(9)
  })

  it('recorta el nombre, convierte lo vacío en null y el objetivo "" en null', () => {
    const request = aRequestProyecto({ nombre: '  Nuevo  ', descripcion: '   ', estado: 'PENDIENTE', prioridad: '', objetivoId: '' })
    expect(request).toEqual({ nombre: 'Nuevo', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null, objetivoId: null })
  })

  it('el objetivo elegido llega como número', () => {
    expect(aRequestProyecto({ nombre: 'X', objetivoId: '12' }).objetivoId).toBe(12)
  })

  it('al crear, un padre elegido se manda y sin elegir queda null; el estado elegido se respeta', () => {
    expect(aRequestProyecto({ nombre: 'X', estado: 'EN_PROGRESO' }, undefined, 4)).toMatchObject({ padreId: 4, estado: 'EN_PROGRESO' })
    expect(aRequestProyecto({ nombre: 'X' }).padreId).toBeNull()
  })
})

describe('aRequestObjetivo', () => {
  it('no incluye objetivoId y reenvía el resto', () => {
    const original = objetivo({ id: 3, nombre: 'Salud', estado: 'HECHO', prioridad: 'BAJA', padreId: 1 })
    const request = aRequestObjetivo(valoresIniciales(original), original)
    expect(request).toEqual({ nombre: 'Salud', descripcion: null, estado: 'HECHO', prioridad: 'BAJA', padreId: 1 })
    expect('objetivoId' in request).toBe(false)
  })
})

describe('cambios rápidos (regresión: un PUT sin estado vuelve a PENDIENTE)', () => {
  it('requestProyectoDe reenvía todo y solo cambia lo del parche', () => {
    expect(requestProyectoDe(ORIGINAL, { estado: 'HECHO' })).toEqual({
      nombre: 'Mudanza',
      descripcion: 'Todo el piso',
      estado: 'HECHO',
      prioridad: 'ALTA',
      padreId: 2,
      objetivoId: 5,
    })
  })

  it('una descripción "" se manda como null (el backend la guarda como "")', () => {
    expect(requestProyectoDe(proyecto({ descripcion: '' })).descripcion).toBeNull()
  })

  it('requestObjetivoDe conserva padre y prioridad', () => {
    const o = objetivo({ nombre: 'Salud', prioridad: 'MEDIA', padreId: 4 })
    expect(requestObjetivoDe(o, { estado: 'EN_PROGRESO' })).toEqual({
      nombre: 'Salud',
      descripcion: null,
      estado: 'EN_PROGRESO',
      prioridad: 'MEDIA',
      padreId: 4,
    })
  })
})
