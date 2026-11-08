import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAhora } from './useAhora'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T23:58:00-03:00'))
})
afterEach(() => vi.useRealTimers())

describe('useAhora', () => {
  it('arranca con el instante y el día actuales', () => {
    const { result } = renderHook(() => useAhora())
    expect(result.current.hoy).toBe('2026-11-10')
    expect(result.current.ahora.getTime()).toBe(new Date('2026-11-10T23:58:00-03:00').getTime())
  })

  it('avanza cada minuto y cambia de día pasada la medianoche', () => {
    const { result } = renderHook(() => useAhora())
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current.ahora.getTime()).toBe(new Date('2026-11-10T23:59:00-03:00').getTime())
    expect(result.current.hoy).toBe('2026-11-10')
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current.hoy).toBe('2026-11-11')
  })

  it('se recalcula al volver a enfocar la ventana', () => {
    const { result } = renderHook(() => useAhora())
    // Simula la pestaña dormida toda la noche: el reloj salta sin que corra el intervalo.
    vi.setSystemTime(new Date('2026-11-11T08:00:00-03:00'))
    expect(result.current.hoy).toBe('2026-11-10')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current.hoy).toBe('2026-11-11')
  })

  it('se recalcula cuando la pestaña vuelve a ser visible', () => {
    const { result } = renderHook(() => useAhora())
    vi.setSystemTime(new Date('2026-11-11T08:00:00-03:00'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.hoy).toBe('2026-11-11')
  })

  it('limpia el intervalo y los oyentes al desmontar', () => {
    const { unmount } = renderHook(() => useAhora())
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
