import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import { DialogosEvento } from './DialogosEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
import { borrarEvento } from '@/api/eventos'
import { getRecordatoriosDeEvento } from '@/api/recordatorios'

const EVENTO: Evento = {
  id: 9,
  titulo: 'Dentista',
  descripcion: '',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: null,
}

const RECORDATORIO: Recordatorio = {
  id: 3,
  tareaId: null,
  eventoId: 9,
  fechaHora: '2026-12-14T09:00:00-03:00',
  canal: 'APP',
  enviado: false,
  descripcion: '',
}

const alMensaje = vi.fn()

/** «Abrir» hace de bloque del evento: con `desapareceAlBorrar`, se va de la página al borrar (como tras el refresco real). */
function Pagina({ evento, desapareceAlBorrar = false }: { evento: Evento; desapareceAlBorrar?: boolean }) {
  const [existe, setExiste] = useState(true)
  const acciones = useAccionesEvento({
    alMensaje: (m) => {
      alMensaje(m)
      if (desapareceAlBorrar) setExiste(false)
    },
  })
  const nuevo = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" ref={nuevo}>
        Nuevo evento
      </button>
      {existe && (
        <button type="button" onClick={() => acciones.abrirEditar(evento)}>
          Abrir
        </button>
      )}
      <DialogosEvento acciones={acciones} focoAlternativo={nuevo} />
    </>
  )
}

async function abrirBorrado(evento: Evento = EVENTO, desapareceAlBorrar = false) {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Pagina evento={evento} desapareceAlBorrar={desapareceAlBorrar} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  await user.click(screen.getByRole('button', { name: 'Borrar evento' }))
  await screen.findByRole('heading', { name: 'Borrar evento' })
  return user
}

/** La confirmación es el último diálogo abierto (la edición queda debajo). */
const confirmacion = () => {
  const dialogos = screen.getAllByRole('dialog')
  return within(dialogos[dialogos.length - 1] as HTMLElement)
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
  vi.mocked(borrarEvento).mockResolvedValue(undefined)
  vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([])
})

describe('BorrarEventoDialog', () => {
  it('sin recordatorio: texto simple con el lapso; foco en «Cancelar»', async () => {
    await abrirBorrado()
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
    expect(
      confirmacion().getByText('¿Borrar el evento «Dentista» (mar 15 dic, 09:00–10:00)? Es definitivo: no se puede deshacer.'),
    ).toBeInTheDocument()
    expect(confirmacion().queryByText(/recordatorio/)).not.toBeInTheDocument()
    expect(confirmacion().getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(getRecordatoriosDeEvento).toHaveBeenCalledWith(9)
  })

  it('mientras consulta el recordatorio, «Borrar» espera', async () => {
    const consulta = pendiente<Recordatorio[]>()
    vi.mocked(getRecordatoriosDeEvento).mockReturnValue(consulta.promesa)
    await abrirBorrado()
    expect(confirmacion().getByText('Comprobando si tiene recordatorio…')).toBeInTheDocument()
    expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeDisabled()
    consulta.resolver([])
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
  })

  it('con recordatorio lo menciona con su fecha y el aviso lo dice al borrar', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([RECORDATORIO])
    const user = await abrirBorrado()
    expect(await confirmacion().findByText('También se borrará su recordatorio (lun 14 dic · 09:00).')).toBeInTheDocument()
    await user.click(confirmacion().getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(borrarEvento).toHaveBeenCalledWith(9)
    expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» borrado, con su recordatorio')
  })

  it('un evento de varios días avisa que se borra entero', async () => {
    await abrirBorrado({ ...EVENTO, fechaHoraInicio: '2026-12-09T22:00:00-03:00', fechaHoraFin: '2026-12-10T02:00:00-03:00' })
    expect(confirmacion().getByText('Se borra el evento entero, no solo este día.')).toBeInTheDocument()
    expect(confirmacion().getByText(/del mié 9 dic, 22:00 al jue 10 dic, 02:00/)).toBeInTheDocument()
  })

  it('si la consulta falla: nota, «Reintentar» y se puede borrar igual', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValueOnce(new ApiError(500, 'Error del servidor (500).'))
    const user = await abrirBorrado()
    expect(await confirmacion().findByText('No se pudo comprobar si tiene recordatorio: si tiene uno, también se borrará.')).toBeInTheDocument()
    expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled()
    vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([RECORDATORIO])
    await user.click(confirmacion().getByRole('button', { name: 'Reintentar' }))
    expect(await confirmacion().findByText(/También se borrará su recordatorio/)).toBeInTheDocument()
  })

  it('con la consulta fallida, borrar manda el DELETE y el aviso no inventa el recordatorio', async () => {
    vi.mocked(getRecordatoriosDeEvento).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    const user = await abrirBorrado()
    await confirmacion().findByText(/No se pudo comprobar/)
    await user.click(confirmacion().getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» borrado'))
  })

  it('«Cancelar» vuelve a la edición con lo escrito intacto y el foco en «Borrar evento»', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <Pagina evento={EVENTO} />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await user.type(screen.getByLabelText('Título'), ' sin guardar')
    await user.click(screen.getByRole('button', { name: 'Borrar evento' }))
    await screen.findByRole('heading', { name: 'Borrar evento' })
    await user.click(confirmacion().getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Dentista sin guardar')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Borrar evento' })).toHaveFocus())
    expect(borrarEvento).not.toHaveBeenCalled()
  })

  it('tras borrar se cierran los dos y el foco va a «Nuevo evento» (el disparador ya no aplica)', async () => {
    const user = await abrirBorrado(EVENTO, true)
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
    await user.click(confirmacion().getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo evento' })).toHaveFocus())
  })

  it('doble clic en «Borrar» = un solo DELETE; mientras borra todo queda deshabilitado', async () => {
    const respuesta = pendiente<void>()
    vi.mocked(borrarEvento).mockReturnValue(respuesta.promesa)
    const user = await abrirBorrado()
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
    await user.dblClick(confirmacion().getByRole('button', { name: 'Borrar' }))
    expect(await confirmacion().findByRole('button', { name: 'Borrando…' })).toBeDisabled()
    expect(confirmacion().getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    respuesta.resolver()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(borrarEvento).toHaveBeenCalledTimes(1)
  })

  it('un 500 deja la confirmación abierta con el mensaje', async () => {
    vi.mocked(borrarEvento).mockRejectedValue(new ApiError(500, 'Error del servidor (500). Inténtalo de nuevo más tarde.'))
    const user = await abrirBorrado()
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
    await user.click(confirmacion().getByRole('button', { name: 'Borrar' }))
    expect(await confirmacion().findByText('Error del servidor (500). Inténtalo de nuevo más tarde.')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
  })

  it('un 404 cierra con «ya no existía»', async () => {
    vi.mocked(borrarEvento).mockRejectedValue(new ApiError(404, 'No existe el evento con id 9'))
    const user = await abrirBorrado()
    await waitFor(() => expect(confirmacion().getByRole('button', { name: 'Borrar' })).toBeEnabled())
    await user.click(confirmacion().getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(alMensaje).toHaveBeenCalledWith('El evento «Dentista» ya no existía')
  })
})
