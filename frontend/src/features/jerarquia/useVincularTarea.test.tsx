import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { tarea } from '@/features/cofre/fabrica'
import { useVincularTarea } from './useVincularTarea'

vi.mock('@/api/proyectos', () => ({ asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ asignarTarea: vi.fn(), quitarTarea: vi.fn() }))
import { asignarTarea as asignarObjetivo, quitarTarea as quitarObjetivo } from '@/api/objetivos'
import { asignarTarea as asignarProyecto, quitarTarea as quitarProyecto } from '@/api/proyectos'

const TAREA = tarea({ id: 12, titulo: 'Embalar' })
const PROYECTO = { id: 7, nombre: 'Mudanza' }

function preparar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const alMensaje = vi.fn()
  const Envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(() => useVincularTarea({ alMensaje }), { wrapper: Envoltorio })
  const claves = () => invalidar.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))
  return { ...hook, alMensaje, claves }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(asignarProyecto).mockResolvedValue(TAREA)
  vi.mocked(asignarObjetivo).mockResolvedValue(TAREA)
  vi.mocked(quitarProyecto).mockResolvedValue(undefined)
  vi.mocked(quitarObjetivo).mockResolvedValue(undefined)
})

describe('useVincularTarea', () => {
  it('asignar a un proyecto: llama a la API, avisa, llama a alExito y refresca solo agenda y tareas', async () => {
    const { result, alMensaje, claves } = preparar()
    const alExito = vi.fn()
    act(() => result.current.asignar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO, alExito }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ahora es del proyecto «Mudanza»'))
    expect(asignarProyecto).toHaveBeenCalledWith(7, 12)
    expect(asignarObjetivo).not.toHaveBeenCalled()
    expect(alExito).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.pendiente).toBe(false))
    expect(claves().sort()).toEqual(['["agenda"]', '["tareas"]'])
  })

  it('asignar a un objetivo usa la API de objetivos', async () => {
    const { result, alMensaje } = preparar()
    act(() => result.current.asignar({ tipo: 'objetivo', tarea: TAREA, destino: { id: 3, nombre: 'Vivir solo' } }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ahora es del objetivo «Vivir solo»'))
    expect(asignarObjetivo).toHaveBeenCalledWith(3, 12)
    expect(asignarProyecto).not.toHaveBeenCalled()
  })

  it('quitar avisa «ya no es del proyecto» y refresca tareas y agenda', async () => {
    const { result, alMensaje, claves } = preparar()
    act(() => result.current.quitar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('«Embalar» ya no es del proyecto «Mudanza»'))
    expect(quitarProyecto).toHaveBeenCalledWith(7, 12)
    await waitFor(() => expect(result.current.pendiente).toBe(false))
    expect(claves().sort()).toEqual(['["agenda"]', '["tareas"]'])
  })

  it('error 400 al quitar: guarda el mensaje, no avisa ni llama a alExito y refresca tareas (no la lista de proyectos)', async () => {
    vi.mocked(quitarProyecto).mockRejectedValue(new ApiError(400, 'La tarea 12 no pertenece al proyecto 7'))
    const { result, alMensaje, claves } = preparar()
    const alExito = vi.fn()
    act(() => result.current.quitar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO, alExito }))
    await waitFor(() => expect(result.current.error).toBe('La tarea 12 no pertenece al proyecto 7'))
    await waitFor(() => expect(result.current.pendiente).toBe(false))
    expect(alMensaje).not.toHaveBeenCalled()
    expect(alExito).not.toHaveBeenCalled()
    expect(claves().sort()).toEqual(['["agenda"]', '["tareas"]'])
  })

  it('error 404 al asignar: refresca también la lista de su tipo', async () => {
    vi.mocked(asignarProyecto).mockRejectedValue(new ApiError(404, 'No existe el proyecto 7'))
    const { result, claves } = preparar()
    act(() => result.current.asignar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO }))
    await waitFor(() => expect(result.current.error).toBe('No existe el proyecto 7'))
    await waitFor(() => expect(claves()).toContain('["proyectos"]'))
    expect(claves()).not.toContain('["objetivos"]')
  })

  it('error 404 con un objetivo refresca ["objetivos"]', async () => {
    vi.mocked(quitarObjetivo).mockRejectedValue(new ApiError(404, 'No existe el objetivo 3'))
    const { result, claves } = preparar()
    act(() => result.current.quitar({ tipo: 'objetivo', tarea: TAREA, destino: { id: 3, nombre: 'Vivir solo' } }))
    await waitFor(() => expect(claves()).toContain('["objetivos"]'))
    expect(claves()).not.toContain('["proyectos"]')
  })

  it('fallo de red: muestra el mensaje y no refresca nada', async () => {
    vi.mocked(asignarProyecto).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const { result, claves } = preparar()
    act(() => result.current.asignar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO }))
    await waitFor(() => expect(result.current.error).toBe('No se pudo conectar con el servidor.'))
    expect(claves()).toEqual([])
  })

  it('dos llamadas seguidas en el mismo instante hacen una sola petición', async () => {
    let resolver: (t: typeof TAREA) => void = () => {}
    vi.mocked(asignarProyecto).mockReturnValue(new Promise((r) => (resolver = r)))
    const { result } = preparar()
    act(() => {
      result.current.asignar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO })
      result.current.asignar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO })
    })
    await waitFor(() => expect(result.current.pendiente).toBe(true))
    resolver(TAREA)
    await waitFor(() => expect(result.current.pendiente).toBe(false))
    expect(asignarProyecto).toHaveBeenCalledTimes(1)
    // Ya liberado, se puede volver a llamar.
    act(() => result.current.quitar({ tipo: 'proyecto', tarea: TAREA, destino: PROYECTO }))
    await waitFor(() => expect(quitarProyecto).toHaveBeenCalledTimes(1))
  })
})
