import { afterEach, describe, expect, it, vi } from 'vitest'

import { enfocarRespaldo, enfocarRespaldoDespues } from './focoRespaldo'

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
