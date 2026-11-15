import { afterEach, describe, expect, it, vi } from 'vitest'

import { enfocarDespues, enfocarRespaldo, enfocarRespaldoDespues, vecinoDe } from './focoRespaldo'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function pagina() {
  document.body.innerHTML = '<h1 data-foco-respaldo tabindex="-1">Hoy</h1><button id="otro">Otro</button>'
  return { h1: document.querySelector('h1') as HTMLElement, otro: document.getElementById('otro') as HTMLElement }
}

describe('enfocarRespaldo', () => {
  it('con el foco en <body> lo lleva al elemento marcado', () => {
    const { h1 } = pagina()
    expect(document.activeElement).toBe(document.body)
    enfocarRespaldo()
    expect(document.activeElement).toBe(h1)
  })

  it('no mueve el foco si ya está en otro control vivo', () => {
    const { otro } = pagina()
    otro.focus()
    enfocarRespaldo()
    expect(document.activeElement).toBe(otro)
  })

  it('sin elemento marcado no hace nada ni falla', () => {
    document.body.innerHTML = '<button>Solo</button>'
    expect(() => enfocarRespaldo()).not.toThrow()
    expect(document.activeElement).toBe(document.body)
  })

  it('enfoca sin desplazar la página (preventScroll)', () => {
    const { h1 } = pagina()
    const espia = vi.spyOn(h1, 'focus')
    enfocarRespaldo()
    expect(espia).toHaveBeenCalledWith({ preventScroll: true })
  })
})

describe('enfocarRespaldoDespues', () => {
  it('actúa en el siguiente ciclo, no antes', () => {
    vi.useFakeTimers()
    const { h1 } = pagina()
    enfocarRespaldoDespues()
    expect(document.activeElement).toBe(document.body)
    vi.runAllTimers()
    expect(document.activeElement).toBe(h1)
  })

  it('si en ese ciclo el foco ya volvió a un control, lo respeta', () => {
    vi.useFakeTimers()
    const { otro } = pagina()
    enfocarRespaldoDespues()
    otro.focus()
    vi.runAllTimers()
    expect(document.activeElement).toBe(otro)
  })
})

describe('vecinoDe', () => {
  const lista = () => {
    document.body.innerHTML = '<button data-x="1"></button><button data-x="2"></button><button data-x="3"></button>'
  }
  it('devuelve el siguiente', () => {
    lista()
    expect(vecinoDe('data-x', 1)).toBe('2')
  })
  it('si es el último, devuelve el anterior', () => {
    lista()
    expect(vecinoDe('data-x', 3)).toBe('2')
  })
  it('sin otros elementos, o con un valor inexistente, devuelve null', () => {
    document.body.innerHTML = '<button data-x="1"></button>'
    expect(vecinoDe('data-x', 1)).toBeNull()
    expect(vecinoDe('data-x', 9)).toBeNull()
  })
})

describe('enfocarDespues', () => {
  it('enfoca el primer selector que exista tras el ciclo de eventos', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<h1 data-foco-respaldo tabindex="-1">H</h1><button id="b">B</button>'
    enfocarDespues(['#no-existe', '#b'])
    expect(document.activeElement).toBe(document.body)
    vi.runAllTimers()
    expect(document.activeElement?.id).toBe('b')
  })
  it('si sigue deshabilitado tras los reintentos, cae al encabezado', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<h1 data-foco-respaldo tabindex="-1">H</h1><button id="b" disabled>B</button>'
    enfocarDespues(['#b', null])
    vi.runAllTimers()
    expect(document.activeElement?.tagName).toBe('H1')
  })
})

describe('enfocarDespues: destino deshabilitado', () => {
  it('espera a que se habilite y entonces lo enfoca', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<h1 data-foco-respaldo tabindex="-1">H</h1><button id="b" disabled>B</button>'
    enfocarDespues(['#b'])
    vi.advanceTimersByTime(60)
    expect(document.activeElement?.tagName).toBe('BODY')
    ;(document.getElementById('b') as HTMLButtonElement).disabled = false
    vi.advanceTimersByTime(60)
    expect(document.activeElement?.id).toBe('b')
  })
})
