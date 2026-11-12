import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import { DialogosEvento } from './DialogosEvento'
import { valoresParaHueco } from './formularioEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({
  getRecordatoriosDeEvento: vi.fn(),
  crearRecordatorio: vi.fn(),
  actualizarRecordatorio: vi.fn(),
  borrarRecordatorio: vi.fn(),
}))
import { actualizarEvento } from '@/api/eventos'
import { borrarRecordatorio, crearRecordatorio, getRecordatoriosDeEvento } from '@/api/recordatorios'

// Botón «Recordatorio…» del diálogo de edición de eventos (9d).

const EVENTO: Evento = {
  id: 9,
  titulo: 'Dentista',
  descripcion: 'Llevar estudios',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: 'MEDIA',
}

function recordatorio(parcial: Partial<Recordatorio> = {}): Recordatorio {
  return { id: 50, tareaId: null, eventoId: 9, fechaHora: '2026-12-15T08:00:00-03:00', canal: 'APP', enviado: false, descripcion: '', ...parcial }
}

/** Lo que "tiene" el servidor: los mocks de escritura lo modifican, así el refresco muestra lo nuevo. */
let servidor: Recordatorio[]

function Pagina({ editar }: { editar: boolean }) {
  const acciones = useAccionesEvento({ alMensaje: vi.fn() })
  const nuevo = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        type="button"
        ref={nuevo}
        onClick={() => (editar ? acciones.abrirEditar(EVENTO) : acciones.abrirCrear(valoresParaHueco('2026-12-15', 9 * 60)))}
      >
        Abrir
      </button>
      <DialogosEvento acciones={acciones} focoAlternativo={nuevo} />
    </>
  )
}

async function montar(editar: boolean, existentes: Recordatorio[] = []) {
  servidor = existentes
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Pagina editar={editar} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

const dialogoEvento = () => screen.getByRole('dialog', { name: 'Editar evento' })
const dialogoRecordatorio = () => screen.findByRole('dialog', { name: 'Recordatorio de «Dentista»' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-10T12:00:00-03:00'))
  vi.resetAllMocks()
  vi.mocked(actualizarEvento).mockImplementation(async (id, r) => ({ id, ...r }))
  vi.mocked(getRecordatoriosDeEvento).mockImplementation(async (id) => servidor.filter((r) => r.eventoId === id))
  vi.mocked(crearRecordatorio).mockImplementation(async (req) => {
    const nuevo = recordatorio({ id: 77, ...req })
    servidor = [...servidor, nuevo]
    return nuevo
  })
  vi.mocked(borrarRecordatorio).mockImplementation(async (id) => {
    servidor = servidor.filter((r) => r.id !== id)
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EventoDialog: botón «Recordatorio…»', () => {
  it('crear un evento no lo ofrece ni consulta recordatorios', async () => {
    await montar(false)
    expect(screen.getByRole('dialog', { name: 'Nuevo evento' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Recordatorio/ })).not.toBeInTheDocument()
    expect(getRecordatoriosDeEvento).not.toHaveBeenCalled()
  })

  it('al editar sin recordatorio dice «Recordatorio…»', async () => {
    await montar(true)
    expect(await screen.findByRole('button', { name: 'Recordatorio…' })).toBeEnabled()
  })

  it('al editar con recordatorio dice «Recordatorio: <fecha y hora corta>»', async () => {
    await montar(true, [recordatorio()])
    expect(await screen.findByRole('button', { name: 'Recordatorio: mar 15 dic · 08:00' })).toBeEnabled()
  })

  it('mientras la consulta carga, el botón ya funciona', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockReturnValue(new Promise(() => {}))
    const user = await montar(true)
    await user.click(screen.getByRole('button', { name: 'Recordatorio…' }))
    expect(await dialogoRecordatorio()).toBeInTheDocument()
  })

  it('si la consulta falla, el botón sigue funcionando y el diálogo no escribe a ciegas', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValue(new ApiError(500, 'Error interno del servidor'))
    const user = await montar(true)
    const boton = await screen.findByRole('button', { name: 'Recordatorio…' })
    expect(boton).toBeEnabled()
    await user.click(boton)
    const d = await dialogoRecordatorio()
    expect(await within(d).findByText('No se pudo consultar el recordatorio de este evento.')).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Crear recordatorio' })).toBeDisabled()
    expect(crearRecordatorio).not.toHaveBeenCalled()
  })

  it('no es de tamaño `sm` (32 px) y en móvil llega a 44 px', async () => {
    await montar(true)
    const boton = await screen.findByRole('button', { name: 'Recordatorio…' })
    expect(boton).toHaveClass('h-10', 'max-sm:h-11')
    expect(boton).not.toHaveClass('h-8')
  })
})

describe('EventoDialog: recordatorio encima de la edición', () => {
  it('se abre encima: lo escrito en el formulario se conserva al cerrar, y el foco vuelve al botón', async () => {
    const user = await montar(true)
    const titulo = screen.getByLabelText('Título')
    await user.clear(titulo)
    await user.type(titulo, 'Dentista (control)')
    const boton = await screen.findByRole('button', { name: 'Recordatorio…' })
    await user.click(boton)
    const d = await dialogoRecordatorio()
    await user.click(within(d).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Recordatorio de «Dentista»' })).not.toBeInTheDocument())
    expect(dialogoEvento()).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Dentista (control)')
    expect(boton).toHaveFocus()
  })

  it('Escape cierra solo el de recordatorio y devuelve el foco al botón', async () => {
    const user = await montar(true)
    const boton = await screen.findByRole('button', { name: 'Recordatorio…' })
    await user.click(boton)
    await dialogoRecordatorio()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Recordatorio de «Dentista»' })).not.toBeInTheDocument())
    expect(dialogoEvento()).toBeInTheDocument()
    expect(boton).toHaveFocus()
  })

  it('crear desde ahí actualiza la etiqueta del botón y no toca el evento', async () => {
    const user = await montar(true)
    await user.click(await screen.findByRole('button', { name: 'Recordatorio…' }))
    const d = await dialogoRecordatorio()
    const crear = await within(d).findByRole('button', { name: 'Crear recordatorio' })
    await waitFor(() => expect(crear).toBeEnabled())
    // Evento a las 09:00: el aviso arranca 60 minutos antes.
    expect(screen.getByLabelText('Fecha y hora')).toHaveValue('2026-12-15T08:00')
    await user.click(crear)
    await waitFor(() =>
      expect(crearRecordatorio).toHaveBeenCalledWith({
        tareaId: null,
        eventoId: 9,
        fechaHora: '2026-12-15T08:00:00-03:00',
        canal: 'APP',
        descripcion: '',
      }),
    )
    await user.click(await within(d).findByRole('button', { name: 'Listo' }))
    expect(await screen.findByRole('button', { name: 'Recordatorio: mar 15 dic · 08:00' })).toBeInTheDocument()
    expect(actualizarEvento).not.toHaveBeenCalled()
  })

  it('quitarlo vuelve a rotular «Recordatorio…»', async () => {
    const user = await montar(true, [recordatorio()])
    await user.click(await screen.findByRole('button', { name: 'Recordatorio: mar 15 dic · 08:00' }))
    const d = await dialogoRecordatorio()
    const quitar = await within(d).findByRole('button', { name: 'Quitar el recordatorio de «Dentista»' })
    await waitFor(() => expect(quitar).toBeEnabled())
    await user.click(quitar)
    await waitFor(() => expect(borrarRecordatorio).toHaveBeenCalledWith(50))
    await user.click(await within(d).findByRole('button', { name: 'Listo' }))
    expect(await screen.findByRole('button', { name: 'Recordatorio…' })).toBeInTheDocument()
  })
})
