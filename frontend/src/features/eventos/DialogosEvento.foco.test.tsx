import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DialogosEvento } from './DialogosEvento'
import { valoresParaHueco } from './formularioEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
import { crearEvento } from '@/api/eventos'

// H-33: al cerrar el diálogo abierto desde un hueco de la semana no se debe perder el sitio en la rejilla.

function Pagina() {
  const acciones = useAccionesEvento({ alMensaje: vi.fn() })
  const nuevo = useRef<HTMLButtonElement>(null)
  const abrir = () => acciones.abrirCrear(valoresParaHueco('2026-12-15', 14 * 60 + 30))
  return (
    <>
      <button type="button" ref={nuevo} onClick={abrir}>
        Nuevo evento
      </button>
      {/* Un hueco de la rejilla: no es enfocable, así que un clic deja el foco en <body>. */}
      <div data-testid="hueco" onClick={abrir} />
      <button type="button" onClick={abrir}>
        Bloque
      </button>
      <DialogosEvento acciones={acciones} focoAlternativo={nuevo} />
    </>
  )
}

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Pagina />
    </QueryClientProvider>,
  )
  const boton = screen.getByRole('button', { name: 'Nuevo evento' })
  return { boton, focus: vi.spyOn(boton, 'focus') }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DialogosEvento: foco al cerrar (H-33)', () => {
  it('abierto desde un hueco (foco en <body>): el respaldo se enfoca SIN desplazar la página', async () => {
    const user = userEvent.setup()
    const { focus } = montar()
    await user.click(screen.getByTestId('hueco'))
    await screen.findByRole('dialog', { name: 'Nuevo evento' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('abierto desde un bloque o botón enfocable: el foco vuelve a él y el respaldo no se toca', async () => {
    const user = userEvent.setup()
    const { focus } = montar()
    await user.click(screen.getByRole('button', { name: 'Bloque' }))
    await screen.findByRole('dialog', { name: 'Nuevo evento' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bloque' })).toHaveFocus())
    expect(focus).not.toHaveBeenCalled()
  })
})
