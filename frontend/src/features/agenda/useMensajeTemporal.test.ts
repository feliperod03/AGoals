import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SALIDA_MS, useMensajeTemporal } from './useMensajeTemporal'

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
    // Primero la fase de salida (el texto sigue para que la animación se vea) y después se vacía.
    expect(result.current.saliendo).toBe(true)
    expect(result.current.mensaje).toBe('Guardada en el cofre')
    act(() => void vi.advanceTimersByTime(SALIDA_MS))
    expect(result.current.mensaje).toBe('')
    expect(result.current.saliendo).toBe(false)
  })

  it('un mensaje nuevo reinicia el temporizador', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    act(() => void vi.advanceTimersByTime(800))
    act(() => result.current.mostrar('Dos'))
    act(() => void vi.advanceTimersByTime(800))
    expect(result.current.mensaje).toBe('Dos')
    act(() => void vi.advanceTimersByTime(200 + SALIDA_MS))
    expect(result.current.mensaje).toBe('')
  })

  it('cerrar salta a la salida y vacía el mensaje', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    act(() => result.current.cerrar())
    expect(result.current.saliendo).toBe(true)
    act(() => void vi.advanceTimersByTime(SALIDA_MS))
    expect(result.current.mensaje).toBe('')
  })

  it('pausar detiene el temporizador y reanudar lo retoma', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    act(() => void vi.advanceTimersByTime(500))
    act(() => result.current.pausar())
    act(() => void vi.advanceTimersByTime(60_000))
    expect(result.current.mensaje).toBe('Uno')
    expect(result.current.saliendo).toBe(false)
    act(() => result.current.reanudar())
    act(() => void vi.advanceTimersByTime(1999))
    expect(result.current.saliendo).toBe(false)
    act(() => void vi.advanceTimersByTime(1 + SALIDA_MS))
    expect(result.current.mensaje).toBe('')
  })

  it('pausar durante la salida la revierte', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current.saliendo).toBe(true)
    act(() => result.current.pausar())
    expect(result.current.saliendo).toBe(false)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(result.current.mensaje).toBe('Uno')
  })

  it('reanudar sin mensaje no programa nada', () => {
    const { result } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.reanudar())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancela el temporizador al desmontar', () => {
    const { result, unmount } = renderHook(() => useMensajeTemporal(1000))
    act(() => result.current.mostrar('Uno'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('persistente', () => {
    it('no expira solo, ni tras pausar y reanudar', () => {
      const { result } = renderHook(() => useMensajeTemporal(1000))
      act(() => result.current.mostrar('Parcial', { persistente: true }))
      expect(result.current.persistente).toBe(true)
      act(() => void vi.advanceTimersByTime(60_000))
      expect(result.current.mensaje).toBe('Parcial')
      expect(result.current.saliendo).toBe(false)
      act(() => result.current.pausar())
      act(() => result.current.reanudar())
      act(() => void vi.advanceTimersByTime(60_000))
      expect(result.current.mensaje).toBe('Parcial')
      expect(vi.getTimerCount()).toBe(0)
    })

    it('cerrar (la «×») lo quita y deja de ser persistente', () => {
      const { result } = renderHook(() => useMensajeTemporal(1000))
      act(() => result.current.mostrar('Parcial', { persistente: true }))
      act(() => result.current.cerrar())
      act(() => void vi.advanceTimersByTime(SALIDA_MS))
      expect(result.current.mensaje).toBe('')
      expect(result.current.persistente).toBe(false)
    })

    it('un mensaje temporal no lo reemplaza', () => {
      const { result } = renderHook(() => useMensajeTemporal(1000))
      act(() => result.current.mostrar('Parcial', { persistente: true }))
      act(() => result.current.mostrar('Hecha'))
      expect(result.current.mensaje).toBe('Parcial')
      act(() => void vi.advanceTimersByTime(60_000))
      expect(result.current.mensaje).toBe('Parcial')
    })

    it('otro persistente sí lo reemplaza', () => {
      const { result } = renderHook(() => useMensajeTemporal(1000))
      act(() => result.current.mostrar('Uno', { persistente: true }))
      act(() => result.current.mostrar('Dos', { persistente: true }))
      expect(result.current.mensaje).toBe('Dos')
    })

    it('tras cerrar el persistente, los temporales vuelven a expirar a los 6 s (regresión)', () => {
      const { result } = renderHook(() => useMensajeTemporal())
      act(() => result.current.mostrar('Parcial', { persistente: true }))
      act(() => result.current.cerrar())
      act(() => void vi.advanceTimersByTime(SALIDA_MS))
      act(() => result.current.mostrar('Hecha'))
      act(() => void vi.advanceTimersByTime(5999))
      expect(result.current.saliendo).toBe(false)
      act(() => void vi.advanceTimersByTime(1 + SALIDA_MS))
      expect(result.current.mensaje).toBe('')
    })
  })
})
