import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { contarSubtareas } from './contarSubtareas'
import { useRecomendacion } from './useRecomendacion'
import type { TareaRecomendada } from '@/types/tarea'

vi.mock('@/api/tareas', () => ({ getRecomendacion: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getRecomendacion } from '@/api/tareas'

function envoltorio() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, Envoltorio }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getRecomendacion).mockResolvedValue([])
  vi.mocked(getProyectos).mockResolvedValue([])
  vi.mocked(getObjetivos).mockResolvedValue([])
})

describe('useRecomendacion', () => {
  it('empieza por prioridad descendente, sin filtro', async () => {
    const { Envoltorio } = envoltorio()
    const { result } = renderHook(() => useRecomendacion('2026-11-10'), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.recomendacion.isSuccess).toBe(true))
    expect(result.current.orden).toBe('prioridad')
    expect(result.current.sentido).toBe('desc')
    expect(result.current.filtro).toBeNull()
    expect(getRecomendacion).toHaveBeenCalledWith({ fecha: '2026-11-10', orden: 'prioridad', sentido: 'desc', proyectoId: undefined, objetivoId: undefined })
  })

  it('cambiar orden, sentido o filtro vuelve a pedir con los parámetros nuevos', async () => {
    const { Envoltorio } = envoltorio()
    const { result } = renderHook(() => useRecomendacion('2026-11-10'), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.recomendacion.isSuccess).toBe(true))

    act(() => result.current.setOrden('antiguedad'))
    act(() => result.current.invertirSentido())
    act(() => result.current.setFiltro({ tipo: 'objetivo', id: 5 }))

    await waitFor(() =>
      expect(getRecomendacion).toHaveBeenLastCalledWith({ fecha: '2026-11-10', orden: 'antiguedad', sentido: 'asc', proyectoId: undefined, objetivoId: 5 }),
    )
  })

  it('la clave de la consulta empieza por "tareas" para que la invalide cualquier cambio de tareas', async () => {
    const { Envoltorio, queryClient } = envoltorio()
    const { result } = renderHook(() => useRecomendacion('2026-11-10'), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.recomendacion.isSuccess).toBe(true))
    const claves = queryClient.getQueryCache().findAll({ queryKey: ['tareas'] })
    expect(claves).toHaveLength(1)
  })
})

describe('contarSubtareas', () => {
  const nodo = (subtareas: TareaRecomendada[] = []) => ({ tarea: {} as TareaRecomendada['tarea'], subtareas })
  it('cuenta descendientes de todos los niveles', () => {
    expect(contarSubtareas(nodo())).toBe(0)
    expect(contarSubtareas(nodo([nodo(), nodo([nodo(), nodo()])]))).toBe(4)
  })
})
