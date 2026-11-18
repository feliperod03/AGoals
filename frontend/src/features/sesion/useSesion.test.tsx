import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { yo } from '@/api/auth'
import { ApiError } from '@/api/client'
import { USUARIO_PRUEBA } from '@/test/sesion'
import { useSesion } from './useSesion'

vi.mock('@/api/auth', () => ({ yo: vi.fn() }))

function envoltorio() {
  const queryClient = new QueryClient()
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.mocked(yo).mockReset()
})

describe('useSesion', () => {
  it('mientras consulta /yo está pendiente', () => {
    vi.mocked(yo).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSesion(), { wrapper: envoltorio() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('con sesión devuelve el usuario', async () => {
    vi.mocked(yo).mockResolvedValue(USUARIO_PRUEBA)
    const { result } = renderHook(() => useSesion(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.data).toEqual(USUARIO_PRUEBA))
  })

  it('un 401 es «sin sesión» (null), no un error', async () => {
    vi.mocked(yo).mockRejectedValue(new ApiError(401, 'Inicia sesión para continuar'))
    const { result } = renderHook(() => useSesion(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
    expect(result.current.isError).toBe(false)
  })

  it('un 500 o la falta de conexión sí son error', async () => {
    vi.mocked(yo).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    const { result } = renderHook(() => useSesion(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
