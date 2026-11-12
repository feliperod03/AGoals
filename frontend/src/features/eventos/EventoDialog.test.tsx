import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Evento } from '@/types/evento'
import { DialogosEvento } from './DialogosEvento'
import { valoresParaHueco, valoresTodoElDia, type ValoresEvento } from './formularioEvento'
import { useAccionesEvento } from './useAccionesEvento'

vi.mock('@/api/eventos', () => ({ crearEvento: vi.fn(), actualizarEvento: vi.fn(), borrarEvento: vi.fn() }))
vi.mock('@/api/recordatorios', () => ({ getRecordatoriosDeEvento: vi.fn() }))
import { actualizarEvento, crearEvento } from '@/api/eventos'
import { getRecordatoriosDeEvento } from '@/api/recordatorios'

const EVENTO: Evento = {
  id: 9,
  titulo: 'Dentista',
  descripcion: 'Llevar estudios',
  fechaHoraInicio: '2026-12-15T09:00:00-03:00',
  fechaHoraFin: '2026-12-15T10:00:00-03:00',
  prioridad: 'MEDIA',
}

const alMensaje = vi.fn()

function Pagina({ abrir }: { abrir: { evento: Evento } | { iniciales: ValoresEvento } }) {
  const acciones = useAccionesEvento({ alMensaje })
  const nuevo = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button type="button" ref={nuevo} onClick={() => ('evento' in abrir ? acciones.abrirEditar(abrir.evento) : acciones.abrirCrear(abrir.iniciales))}>
        Abrir
      </button>
      <DialogosEvento acciones={acciones} focoAlternativo={nuevo} />
    </>
  )
}

async function montar(abrir: { evento: Evento } | { iniciales: ValoresEvento }) {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Pagina abrir={abrir} />
    </QueryClientProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Abrir' }))
  return user
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement
const cambiar = (nombre: string, valor: string) => fireEvent.change(campo(nombre), { target: { value: valor } })
const dialogo = () => screen.queryByRole('dialog')

function pendiente<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((r, j) => {
    resolver = r
    rechazar = j
  })
  return { promesa, resolver, rechazar }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(crearEvento).mockImplementation(async (r) => ({ id: 50, ...r }))
  vi.mocked(actualizarEvento).mockImplementation(async (id, r) => ({ id, ...r }))
  vi.mocked(getRecordatoriosDeEvento).mockResolvedValue([])
})

describe('EventoDialog: crear', () => {
  it('título, descripción y valores por defecto; foco en el título', async () => {
    await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    expect(screen.getByRole('heading', { name: 'Nuevo evento' })).toBeInTheDocument()
    expect(screen.getByText('Anota la cita o el compromiso.')).toBeInTheDocument()
    expect(campo('Día de inicio').value).toBe('2026-12-15')
    expect(campo('Hora de inicio').value).toBe('09:00')
    expect(campo('Día de fin').value).toBe('2026-12-15')
    expect(campo('Hora de fin').value).toBe('10:00')
    expect(campo('Prioridad').value).toBe('')
    expect(screen.getByRole('checkbox', { name: 'Todo el día' })).not.toBeChecked()
    expect(campo('Título')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Borrar evento' })).not.toBeInTheDocument()
  })

  it('guardar manda el POST con el cuerpo exacto, avisa y cierra', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.type(campo('Título'), '  Dentista  ')
    await user.type(campo('Descripción'), 'Llevar estudios')
    await user.selectOptions(campo('Prioridad'), 'ALTA')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(crearEvento).toHaveBeenCalledWith({
      titulo: 'Dentista',
      descripcion: 'Llevar estudios',
      fechaHoraInicio: '2026-12-15T09:00:00-03:00',
      fechaHoraFin: '2026-12-15T10:00:00-03:00',
      prioridad: 'ALTA',
    })
    expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista» creado (mar 15 dic, 09:00–10:00)')
  })

  it('al cerrar, el foco vuelve a quien abrió el diálogo', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus())
  })
})

describe('EventoDialog: validación sin llamar al servidor', () => {
  it.each([
    ['', 'El título es obligatorio'],
    ['   ', 'El título es obligatorio'],
  ])('título %j', async (titulo, mensaje) => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    if (titulo) await user.type(campo('Título'), titulo)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(campo('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('título de 201 caracteres', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.click(campo('Título'))
    await user.paste('a'.repeat(201))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título admite como máximo 200 caracteres')).toBeInTheDocument()
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('fin igual al inicio: error en el fin, con aria-invalid y aria-describedby', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.type(campo('Título'), 'Dentista')
    cambiar('Hora de fin', '09:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const error = await screen.findByText('El fin debe ser posterior al inicio')
    expect(campo('Hora de fin')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('Día de fin')).toHaveAttribute('aria-describedby', error.id)
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('el error de fecha se borra al tocar una fecha u hora', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.type(campo('Título'), 'Dentista')
    cambiar('Hora de fin', '08:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('El fin debe ser posterior al inicio')
    cambiar('Hora de fin', '11:00')
    expect(screen.queryByText('El fin debe ser posterior al inicio')).not.toBeInTheDocument()
  })

  it('todo el día con el último día antes del primero', async () => {
    const user = await montar({ iniciales: valoresTodoElDia('2026-12-15') })
    await user.type(campo('Título'), 'Feriado')
    cambiar('Último día', '2026-12-14')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El último día no puede ser anterior al primero')).toBeInTheDocument()
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('título vacío y fin anterior al inicio a la vez: se ven los dos mensajes y no hay llamadas al servidor', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    cambiar('Hora de fin', '08:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El fin debe ser posterior al inicio')).toBeInTheDocument()
    expect(campo('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(campo('Hora de fin')).toHaveAttribute('aria-invalid', 'true')
    expect(crearEvento).not.toHaveBeenCalled()
    expect(actualizarEvento).not.toHaveBeenCalled()
  })

  it('título vacío y fechas vacías a la vez: los tres mensajes', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    cambiar('Hora de inicio', '')
    cambiar('Día de fin', '')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('Indica el día y la hora de inicio')).toBeInTheDocument()
    expect(screen.getByText('Indica el día y la hora de fin')).toBeInTheDocument()
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('con el título válido y solo el fin mal, sale solo el error del fin; con solo el título mal, solo el del título', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.type(campo('Título'), 'Dentista')
    cambiar('Hora de fin', '08:00')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El fin debe ser posterior al inicio')).toBeInTheDocument()
    expect(screen.queryByText('El título es obligatorio')).not.toBeInTheDocument()
    cambiar('Hora de fin', '10:00')
    await user.clear(campo('Título'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument()
    expect(screen.queryByText('El fin debe ser posterior al inicio')).not.toBeInTheDocument()
    expect(crearEvento).not.toHaveBeenCalled()
  })

  it('una hora vacía', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    await user.type(campo('Título'), 'Dentista')
    cambiar('Hora de inicio', '')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Indica el día y la hora de inicio')).toBeInTheDocument()
    expect(crearEvento).not.toHaveBeenCalled()
  })
})

describe('EventoDialog: fechas', () => {
  it('cambiar el día de inicio corre el fin conservando la duración', async () => {
    await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    cambiar('Día de inicio', '2026-12-17')
    expect(campo('Día de fin').value).toBe('2026-12-17')
    cambiar('Hora de inicio', '22:30')
    expect(campo('Día de fin').value).toBe('2026-12-17')
    expect(campo('Hora de fin').value).toBe('23:30')
    cambiar('Hora de inicio', '23:30')
    expect(campo('Día de fin').value).toBe('2026-12-18')
    expect(campo('Hora de fin').value).toBe('00:30')
  })

  it('cambiar el fin no mueve el inicio', async () => {
    await montar({ iniciales: valoresParaHueco('2026-12-15', 9 * 60) })
    cambiar('Hora de fin', '12:00')
    expect(campo('Hora de inicio').value).toBe('09:00')
  })

  it('«Todo el día» oculta las horas, cambia los rótulos y manda 00:00 a 00:00 del día siguiente al último', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-02', 9 * 60) })
    await user.type(campo('Título'), 'Congreso')
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(screen.queryByLabelText('Hora de inicio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Hora de fin')).not.toBeInTheDocument()
    expect(campo('Primer día').value).toBe('2026-12-02')
    cambiar('Último día', '2026-12-04')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(crearEvento).toHaveBeenCalled())
    expect(vi.mocked(crearEvento).mock.calls[0]?.[0]).toMatchObject({
      titulo: 'Congreso',
      fechaHoraInicio: '2026-12-02T00:00:00-03:00',
      fechaHoraFin: '2026-12-05T00:00:00-03:00',
    })
  })

  it('desmarcar «Todo el día» recupera las horas y lo escrito', async () => {
    const user = await montar({ iniciales: valoresParaHueco('2026-12-15', 14 * 60) })
    await user.type(campo('Título'), 'Reunión')
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    await user.click(screen.getByRole('checkbox', { name: 'Todo el día' }))
    expect(campo('Título').value).toBe('Reunión')
    expect(campo('Hora de inicio').value).toBe('14:00')
    expect(campo('Hora de fin').value).toBe('15:00')
  })
})

describe('EventoDialog: editar', () => {
  it('carga el evento y el PUT manda los cinco campos aunque solo cambie el título', async () => {
    const user = await montar({ evento: EVENTO })
    expect(screen.getByRole('heading', { name: 'Editar evento' })).toBeInTheDocument()
    expect(campo('Título').value).toBe('Dentista')
    expect(campo('Descripción').value).toBe('Llevar estudios')
    expect(campo('Prioridad').value).toBe('MEDIA')
    // Al editar se consulta el recordatorio del evento (9d), una sola vez al abrir.
    await waitFor(() => expect(getRecordatoriosDeEvento).toHaveBeenCalledTimes(1))
    expect(getRecordatoriosDeEvento).toHaveBeenCalledWith(9)
    await user.clear(campo('Título'))
    await user.type(campo('Título'), 'Dentista (control)')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledWith(9, {
      titulo: 'Dentista (control)',
      descripcion: 'Llevar estudios',
      fechaHoraInicio: '2026-12-15T09:00:00-03:00',
      fechaHoraFin: '2026-12-15T10:00:00-03:00',
      prioridad: 'MEDIA',
    })
    expect(alMensaje).toHaveBeenCalledWith('Evento «Dentista (control)» guardado (mar 15 dic, 09:00–10:00)')
  })

  it('un evento que cruza la medianoche muestra el fin al día siguiente y avisa que dura varios días', async () => {
    await montar({ evento: { ...EVENTO, fechaHoraInicio: '2026-12-09T22:00:00-03:00', fechaHoraFin: '2026-12-10T02:00:00-03:00' } })
    expect(campo('Día de inicio').value).toBe('2026-12-09')
    expect(campo('Hora de inicio').value).toBe('22:00')
    expect(campo('Día de fin').value).toBe('2026-12-10')
    expect(campo('Hora de fin').value).toBe('02:00')
    expect(screen.getByText('Dura varios días: los cambios valen para todo el evento.')).toBeInTheDocument()
  })

  it('un evento de un solo día no lleva el aviso de varios días', async () => {
    await montar({ evento: EVENTO })
    expect(screen.queryByText(/Dura varios días/)).not.toBeInTheDocument()
  })

  it('un evento de todo el día abre con la casilla marcada y sin horas', async () => {
    await montar({ evento: { ...EVENTO, fechaHoraInicio: '2026-12-08T00:00:00-03:00', fechaHoraFin: '2026-12-09T00:00:00-03:00' } })
    expect(screen.getByRole('checkbox', { name: 'Todo el día' })).toBeChecked()
    expect(campo('Primer día').value).toBe('2026-12-08')
    expect(campo('Último día').value).toBe('2026-12-08')
    expect(screen.queryByLabelText('Hora de inicio')).not.toBeInTheDocument()
  })

  it('mientras guarda: botones deshabilitados, «Guardando…» y Escape no cierra; doble clic = un solo PUT', async () => {
    const respuesta = pendiente<Evento>()
    vi.mocked(actualizarEvento).mockReturnValue(respuesta.promesa)
    const user = await montar({ evento: EVENTO })
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    await user.dblClick(guardar)
    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Borrar evento' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(dialogo()).toBeInTheDocument()
    respuesta.resolver(EVENTO)
    await waitFor(() => expect(dialogo()).not.toBeInTheDocument())
    expect(actualizarEvento).toHaveBeenCalledTimes(1)
  })

  it.each([
    [new ApiError(400, "'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'")],
    [new ApiError(404, 'No existe el evento con id 9')],
    [new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.')],
  ])('error del servidor (%s): queda abierto con el mensaje y lo escrito intacto', async (error) => {
    vi.mocked(actualizarEvento).mockRejectedValue(error)
    const user = await montar({ evento: EVENTO })
    await user.type(campo('Título'), ' 2')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(error.message)).toBeInTheDocument()
    expect(dialogo()).toBeInTheDocument()
    expect(campo('Título').value).toBe('Dentista 2')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('«Borrar evento» abre la confirmación encima', async () => {
    const user = await montar({ evento: EVENTO })
    await user.click(screen.getByRole('button', { name: 'Borrar evento' }))
    expect(await screen.findByRole('heading', { name: 'Borrar evento' })).toBeInTheDocument()
  })
})
