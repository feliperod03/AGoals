import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLAVE_TEMA } from './tema'
import { useTema } from './useTema'

type Oyente = () => void

function simularSistema(oscuro: boolean) {
  const oyentes = new Set<Oyente>()
  const media = {
    matches: oscuro,
    addEventListener: (_: string, f: Oyente) => oyentes.add(f),
    removeEventListener: (_: string, f: Oyente) => oyentes.delete(f),
  }
  vi.stubGlobal('matchMedia', () => media)
  return {
    oyentes,
    cambiarA(valor: boolean) {
      media.matches = valor
      oyentes.forEach((f) => f())
    },
  }
}

const hayDark = () => document.documentElement.classList.contains('dark')

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('useTema', () => {
  it('sin elección guardada sigue al sistema, también en vivo', () => {
    const sistema = simularSistema(false)
    const { result } = renderHook(() => useTema())
    expect(result.current.preferencia).toBe('sistema')
    expect(hayDark()).toBe(false)
    act(() => sistema.cambiarA(true))
    expect(hayDark()).toBe(true)
    act(() => sistema.cambiarA(false))
    expect(hayDark()).toBe(false)
  })

  it('con una elección guardada ignora al sistema', () => {
    localStorage.setItem(CLAVE_TEMA, 'oscuro')
    const sistema = simularSistema(false)
    const { result } = renderHook(() => useTema())
    expect(result.current.preferencia).toBe('oscuro')
    expect(hayDark()).toBe(true)
    expect(sistema.oyentes.size).toBe(0)
  })

  it('un valor guardado inválido se trata como sistema', () => {
    localStorage.setItem(CLAVE_TEMA, 'azul')
    simularSistema(true)
    const { result } = renderHook(() => useTema())
    expect(result.current.preferencia).toBe('sistema')
    expect(hayDark()).toBe(true)
  })

  it('ciclar recorre los tres estados, guarda y gestiona el listener', () => {
    const sistema = simularSistema(true)
    const { result } = renderHook(() => useTema())
    expect(sistema.oyentes.size).toBe(1)

    act(() => result.current.ciclar())
    expect(result.current.preferencia).toBe('claro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
    expect(hayDark()).toBe(false)
    expect(sistema.oyentes.size).toBe(0)

    act(() => result.current.ciclar())
    expect(result.current.preferencia).toBe('oscuro')
    expect(hayDark()).toBe(true)

    act(() => result.current.ciclar())
    expect(result.current.preferencia).toBe('sistema')
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull()
    expect(sistema.oyentes.size).toBe(1)
    expect(hayDark()).toBe(true)
  })

  it('quita el listener al desmontar', () => {
    const sistema = simularSistema(false)
    const { unmount } = renderHook(() => useTema())
    expect(sistema.oyentes.size).toBe(1)
    unmount()
    expect(sistema.oyentes.size).toBe(0)
  })

  it('si localStorage falla sigue funcionando en memoria', () => {
    simularSistema(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin acceso')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin acceso')
    })
    const { result } = renderHook(() => useTema())
    expect(result.current.preferencia).toBe('sistema')
    act(() => result.current.ciclar())
    act(() => result.current.ciclar())
    expect(result.current.preferencia).toBe('oscuro')
    expect(hayDark()).toBe(true)
  })
})
