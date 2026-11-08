import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMensajeTemporal } from './useMensajeTemporal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useMensajeTemporal', () => {
  it('muestra el mensaje y lo borra pasado el tiempo', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Guardada en el cofre'))
    expect(result.current.mensaje).toBe('Guardada en el cofre')
    act(() => void vi.advanceTimersByTime(999))
    expect(result.current.mensaje).toBe('Guardada en el cofre')
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current.mensaje).toBe('')
  })

  it('un mensaje nuevo reinicia el temporizador', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    act(() => void vi.advanceTimersByTime(800))
    act(() => result.current.mostrar('Dos'))
    act(() => void vi.advanceTimersByTime(800))
    expect(result.current.mensaje).toBe('Dos')
    act(() => void vi.advanceTimersByTime(200))
    expect(result.current.mensaje).toBe('')
  })

  it('cancela el temporizador al desmontar', () => {
    const { result, unmount } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
