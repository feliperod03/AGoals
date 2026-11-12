import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento, EventoRequest } from '@/types/evento'
import { valoresParaHueco } from './formularioEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
import { actualizarEvento, borrarEvento, crearEvento } from '@/api/eventos'

const EVENTO: Evento = {
  id: 9,
  titulo: 'Dentista',
  descripcion: '',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: null,
}
const REQUEST: EventoRequest = {
  titulo: 'Dentista',
  descripcion: '',
  fechaHoraInicio: EVENTO.fechaHoraInicio,
  fechaHoraFin: EVENTO.fechaHoraFin,
  prioridad: null,
}

function preparar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
  const alMensaje = vi.fn()
  const alCrear = vi.fn()
  const Envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(() => useAccionesEvento({ alMensaje, alCrear }), { wrapper: Envoltorio })
  const claves = () => invalidar.mock.calls.map(([f]) => JSON.stringify(f?.queryKey)).sort()
  return { ...hook, queryClient, alMensaje, alCrear, claves }
}

function pendiente<T>() {
  let resolver!: (valor: T) => void
  const promesa = new Promise<T>((r) => {
    resolver = r
  })
  return { promesa, resolver }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(crearEvento).mockResolvedValue(EVENTO)
  vi.mocked(actualizarEvento).mockResolvedValue(EVENTO)
  vi.mocked(borrarEvento).mockResolvedValue(undefined)
})

describe('useAccionesEvento: guardar', () => {
  it('crear: POST, refresca solo eventos, cierra, avisa y llama a alCrear con el evento creado', async () => {
    const { result, alMensaje, alCrear, claves } = preparar()
    act(() => result.current.abrirCrear(valoresParaHueco('2026-12-15', 540)))
    expect(result.current.dialogo?.iniciales).toBeDefined()
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» creado (mar 15 dic, 09:00–10:00)'))
    expect(crearEvento).toHaveBeenCalledWith(REQUEST)
    expect(actualizarEvento).not.toHaveBeenCalled()
    expect(alCrear).toHaveBeenCalledWith(EVENTO)
    expect(result.current.dialogo).toBeNull()
    expect(claves()).toEqual(['["eventos"]'])
  })

  it('editar: PUT al id del evento abierto, sin alCrear', async () => {
    const { result, alMensaje, alCrear } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.guardar({ ...REQUEST, titulo: 'Dentista nuevo' }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» guardado (mar 15 dic, 09:00–10:00)'))
    expect(actualizarEvento).toHaveBeenCalledWith(9, { ...REQUEST, titulo: 'Dentista nuevo' })
    expect(alCrear).not.toHaveBeenCalled()
  })

  it('el refresco termina ANTES de cerrar el diálogo (y mientras tanto sigue «guardando»)', async () => {
    const { result, queryClient } = preparar()
    const refresco = pendiente<void>()
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(refresco.promesa)
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(actualizarEvento).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.dialogo).not.toBeNull()
    expect(result.current.guardando).toBe(true)
    await act(async () => refresco.resolver())
    await waitFor(() => expect(result.current.dialogo).toBeNull())
  })

  it('doble llamada seguida = una sola petición', async () => {
    const { result } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => {
      result.current.guardar(REQUEST)
      result.current.guardar(REQUEST)
    })
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(actualizarEvento).toHaveBeenCalledTimes(1)
  })

  it('404 al guardar: deja el mensaje, no cierra y refresca eventos y recordatorios', async () => {
    vi.mocked(actualizarEvento).mockRejectedValue(new ApiError(404, 'No existe el evento con id 9'))
    const { result, alMensaje, claves } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(result.current.errorGuardar).toBe('No existe el evento con id 9'))
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(result.current.dialogo).not.toBeNull()
    expect(alMensaje).not.toHaveBeenCalled()
    expect(claves()).toEqual(['["eventos"]', '["recordatorios"]'])
  })

  it('400 al guardar: deja el mensaje y no refresca nada', async () => {
    vi.mocked(crearEvento).mockRejectedValue(new ApiError(400, "'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'"))
    const { result, claves } = preparar()
    act(() => result.current.abrirCrear(valoresParaHueco('2026-12-15', 540)))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(result.current.errorGuardar).toBe("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'"))
    expect(claves()).toEqual([])
  })

  it('tras un error se puede volver a intentar (el guard se libera)', async () => {
    vi.mocked(actualizarEvento).mockRejectedValueOnce(new ApiError(0, 'Sin conexión'))
    const { result, alMensaje } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(result.current.errorGuardar).toBe('Sin conexión'))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(alMensaje).toHaveBeenCalled())
    expect(actualizarEvento).toHaveBeenCalledTimes(2)
  })

  it('abrir de nuevo limpia el error anterior y guarda el disparador', async () => {
    vi.mocked(actualizarEvento).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    const { result } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.guardar(REQUEST))
    await waitFor(() => expect(result.current.errorGuardar).not.toBeNull())
    const boton = document.createElement('button')
    document.body.append(boton)
    boton.focus()
    act(() => result.current.abrirEditar(EVENTO))
    expect(result.current.errorGuardar).toBeNull()
    expect(result.current.disparador.current).toBe(boton)
    boton.remove()
  })
})

describe('useAccionesEvento: borrar', () => {
  it('DELETE, refresca eventos y recordatorios, cierra los dos diálogos y avisa', async () => {
    const { result, alMensaje, claves } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => result.current.borrar(true))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» borrado, con su recordatorio'))
    expect(borrarEvento).toHaveBeenCalledWith(9)
    expect(result.current.borrado).toBeNull()
    expect(result.current.dialogo).toBeNull()
    expect(claves()).toEqual(['["eventos"]', '["recordatorios"]'])
  })

  it('sin recordatorio el aviso no lo menciona', async () => {
    const { result, alMensaje } = preparar()
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => result.current.borrar(false))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» borrado'))
  })

  it('doble confirmación = un solo DELETE', async () => {
    const { result } = preparar()
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => {
      result.current.borrar(false)
      result.current.borrar(false)
    })
    await waitFor(() => expect(result.current.borrando).toBe(false))
    expect(borrarEvento).toHaveBeenCalledTimes(1)
  })

  it('404: cierra con «ya no existía» y refresca eventos y recordatorios', async () => {
    vi.mocked(borrarEvento).mockRejectedValue(new ApiError(404, 'No existe el evento con id 9'))
    const { result, alMensaje, claves } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => result.current.borrar(false))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('El evento «Dentista» ya no existía'))
    expect(result.current.borrado).toBeNull()
    expect(result.current.dialogo).toBeNull()
    expect(result.current.errorBorrar).toBeNull()
    expect(claves()).toEqual(['["eventos"]', '["recordatorios"]'])
  })

  it('500: la confirmación queda abierta con el mensaje y no refresca', async () => {
    vi.mocked(borrarEvento).mockRejectedValue(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    const { result, alMensaje, claves } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => result.current.borrar(false))
    await waitFor(() => expect(result.current.errorBorrar).toBe('Error del servidor (500). Inténtalo de nuevo más tarde.'))
    expect(result.current.borrado).toEqual(EVENTO)
    expect(result.current.dialogo).not.toBeNull()
    expect(alMensaje).not.toHaveBeenCalled()
    expect(claves()).toEqual([])
  })

  it('cancelar cierra solo la confirmación', () => {
    const { result } = preparar()
    act(() => result.current.abrirEditar(EVENTO))
    act(() => result.current.pedirBorrado(EVENTO))
    act(() => result.current.cancelarBorrado())
    expect(result.current.borrado).toBeNull()
    expect(result.current.dialogo).not.toBeNull()
  })
})
