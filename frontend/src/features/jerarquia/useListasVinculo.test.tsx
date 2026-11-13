import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from './config'
import { useListaJerarquia } from './useListaJerarquia'
import { CLAVE_OBJETIVOS, CLAVE_PROYECTOS, useObjetivos, useProyectos } from './useListasVinculo'

vi.mock('@/api/proyectos', async (original) => ({ ...(await original<object>()), getProyectos: vi.fn() }))
vi.mock('@/api/objetivos', async (original) => ({ ...(await original<object>()), getObjetivos: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

function envoltorio() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getProyectos).mockResolvedValue([])
  vi.mocked(getObjetivos).mockResolvedValue([])
})

describe('useListasVinculo', () => {
  it('usa las mismas claves que la configuración de proyectos y objetivos', () => {
    expect(CONFIG_PROYECTO.claveLista).toEqual(CLAVE_PROYECTOS)
    expect(CONFIG_OBJETIVO.claveLista).toEqual(CLAVE_OBJETIVOS)
  })

  it('comparten caché con useListaJerarquia: una sola llamada a la API', async () => {
    const { result } = renderHook(() => ({ vinculo: useProyectos(), lista: useListaJerarquia(CONFIG_PROYECTO) }), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.vinculo.isSuccess && result.current.lista.isSuccess).toBe(true))
    expect(getProyectos).toHaveBeenCalledTimes(1)
  })

  it('useObjetivos pide los objetivos', async () => {
    const { result } = renderHook(() => useObjetivos(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getObjetivos).toHaveBeenCalledTimes(1)
  })
})
