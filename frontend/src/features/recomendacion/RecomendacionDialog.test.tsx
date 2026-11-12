import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea, TareaRecomendada } from '@/types/tarea'
import { RecomendacionDialog } from './RecomendacionDialog'

vi.mock('@/api/tareas', () => ({ getRecomendacion: vi.fn(), agendarTarea: vi.fn() }))
vi.mock('@/api/proyectos', () => ({ getProyectos: vi.fn() }))
vi.mock('@/api/objetivos', () => ({ getObjetivos: vi.fn() }))
import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { agendarTarea, getRecomendacion } from '@/api/tareas'

const HOY = '2026-11-10'

function tarea(parcial: Partial<Tarea>): Tarea {
  return {
    id: 1,
    titulo: 'Tarea',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: null,
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

const rec = (parcial: Partial<Tarea>, subtareas: TareaRecomendada[] = []): TareaRecomendada => ({ tarea: tarea(parcial), subtareas })

const PROYECTOS: Proyecto[] = [
  { id: 10, nombre: 'Mudanza', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null, objetivoId: null, fechaCreacion: '2026-11-01T10:00:00-03:00' },
  { id: 11, nombre: 'Acción social', descripcion: null, estado: 'HECHO', prioridad: null, padreId: null, objetivoId: null, fechaCreacion: '2026-11-01T10:00:00-03:00' },
]
const OBJETIVOS: Objetivo[] = [
  { id: 20, nombre: 'Vivir mejor', descripcion: null, estado: 'PENDIENTE', prioridad: null, padreId: null, fechaCreacion: '2026-11-01T10:00:00-03:00' },
]

/** Madre sin fecha con una subtarea atrasada que tiene su propia nieta, y una tarea atrasada suelta. */
const LISTA: TareaRecomendada[] = [
  rec({ id: 1, titulo: 'Armar la casa', prioridad: 'ALTA', proyectoId: 10 }, [
    rec({ id: 2, titulo: 'Pintar paredes', fecha: '2026-11-03', padreId: 1 }, [rec({ id: 3, titulo: 'Comprar pintura', padreId: 2, objetivoId: 20 })]),
  ]),
  rec({ id: 4, titulo: 'Llamar al banco', fecha: '2026-11-08', prioridad: 'BAJA' }),
]

let avisos: string[]

function renderizar({ aviso = '' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const alCerrar = vi.fn()
  const vista = render(
    <QueryClientProvider client={queryClient}>
      <RecomendacionDialog abierto alCerrar={alCerrar} hoy={HOY} aviso={aviso} alAvisar={(m) => avisos.push(m)} />
    </QueryClientProvider>,
  )
  return { alCerrar, queryClient, ...vista }
}

beforeEach(() => {
  avisos = []
  vi.resetAllMocks()
  vi.mocked(getRecomendacion).mockResolvedValue(LISTA)
  vi.mocked(getProyectos).mockResolvedValue(PROYECTOS)
  vi.mocked(getObjetivos).mockResolvedValue(OBJETIVOS)
})

describe('RecomendacionDialog: lista', () => {
  it('pide la recomendación de hoy con prioridad descendente por defecto', async () => {
    renderizar()
    await screen.findByText('Armar la casa')
    expect(getRecomendacion).toHaveBeenCalledWith({ fecha: HOY, orden: 'prioridad', sentido: 'desc', proyectoId: undefined, objetivoId: undefined })
  })

  it('muestra la madre con sus subtareas anidadas, marcas, prioridad y vínculo', async () => {
    renderizar()
    await screen.findByText('Armar la casa')

    const raices = screen.getAllByRole('listitem').filter((li) => li.parentElement === screen.getByText('Armar la casa').closest('ul'))
    expect(raices).toHaveLength(2)

    const madre = raices[0]!
    // La madre y su nieta no tienen fecha.
    expect(within(madre).getAllByText('Sin fecha')).toHaveLength(2)
    expect(within(madre).getByText('Alta')).toBeInTheDocument()
    expect(within(madre).getByText('Proyecto: Mudanza')).toBeInTheDocument()
    // Subtarea y nieta, anidadas dentro de la madre.
    expect(within(madre).getByText('Pintar paredes')).toBeInTheDocument()
    expect(within(madre).getByText('Atrasada desde 3 de noviembre')).toBeInTheDocument()
    expect(within(madre).getByText('Comprar pintura')).toBeInTheDocument()
    expect(within(madre).getByText('Objetivo: Vivir mejor')).toBeInTheDocument()

    const suelta = raices[1]!
    expect(within(suelta).getByText('Atrasada desde 8 de noviembre')).toBeInTheDocument()
    expect(within(suelta).getByText('Baja')).toBeInTheDocument()
    expect(within(suelta).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('el control de subtareas cuenta descendientes de todos los niveles y solo hay agendar en las raíces', async () => {
    renderizar()
    expect(await screen.findByRole('checkbox', { name: /Incluir 2 subtareas/ })).toBeChecked()
    expect(screen.getAllByRole('button', { name: /^Agendar/ })).toHaveLength(2)
  })

  it('muestra el estado de carga y luego el vacío', async () => {
    vi.mocked(getRecomendacion).mockResolvedValue([])
    renderizar()
    expect(screen.getByText('Cargando recomendaciones…')).toBeInTheDocument()
    expect(await screen.findByText('No hay tareas para recomendar')).toBeInTheDocument()
  })

  it('muestra el error legible si falla la carga', async () => {
    vi.mocked(getRecomendacion).mockRejectedValue(new ApiError(0, 'No se pudo conectar con el servidor.'))
    renderizar()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.')
  })

  it('repite el aviso de la página en una región viva propia', async () => {
    renderizar({ aviso: '«X» agendada para hoy' })
    expect(await screen.findByRole('status')).toHaveTextContent('«X» agendada para hoy')
  })
})

describe('RecomendacionDialog: orden y sentido', () => {
  it('cambia a antigüedad y vuelve a pedir', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    expect(screen.getByRole('button', { name: 'Prioridad' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Antigüedad' }))

    expect(screen.getByRole('button', { name: 'Antigüedad' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'antiguedad', sentido: 'desc' })))
  })

  it('invierte el sentido y lo dice con palabras', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')

    await user.click(screen.getByRole('button', { name: /Invertir el sentido \(ahora: Alta primero\)/ }))

    expect(await screen.findByRole('button', { name: /ahora: Baja primero/ })).toBeInTheDocument()
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ orden: 'prioridad', sentido: 'asc' })))
  })
})

describe('RecomendacionDialog: filtro', () => {
  it('filtra por proyecto buscando por nombre sin tildes y se puede quitar', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')

    await user.click(screen.getByRole('button', { name: 'Proyecto' }))
    // Los proyectos cerrados también se listan.
    expect(await screen.findByRole('button', { name: 'Acción social' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar proyecto' }), 'accion')
    expect(screen.queryByRole('button', { name: 'Mudanza' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Acción social' }))
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ proyectoId: 11, objetivoId: undefined })))

    await user.click(screen.getByRole('button', { name: 'Quitar filtro «Acción social»' }))
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ proyectoId: undefined, objetivoId: undefined })))
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filtra por objetivo y cambiar de tipo quita el filtro anterior (uno a la vez)', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')

    await user.click(screen.getByRole('button', { name: 'Objetivo' }))
    await user.click(await screen.findByRole('button', { name: 'Vivir mejor' }))
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ objetivoId: 20, proyectoId: undefined })))

    await user.click(screen.getByRole('button', { name: 'Proyecto' }))
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ objetivoId: undefined, proyectoId: undefined })))
  })

  it('si falla el listado lo dice, pero la lista de tareas sigue', async () => {
    vi.mocked(getProyectos).mockRejectedValue(new ApiError(500, 'Error del servidor (500).'))
    renderizar()
    expect(await screen.findByText('Armar la casa')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor (500).')
  })
})

describe('RecomendacionDialog: agendar', () => {
  it('agenda con subtareas por defecto, avisa y el diálogo sigue abierto', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 1, fecha: HOY }), tarea({ id: 2, fecha: HOY }), tarea({ id: 3, fecha: HOY })])
    const { alCerrar, queryClient } = renderizar()
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries')
    await screen.findByText('Armar la casa')

    await user.click(screen.getByRole('button', { name: 'Agendar «Armar la casa» para hoy' }))

    await waitFor(() => expect(avisos).toEqual(['«Armar la casa» agendada para hoy (con 2 subtareas)']))
    expect(agendarTarea).toHaveBeenCalledWith(1, { fecha: HOY, hoy: HOY, incluirSubtareas: true })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['tareas'] })
    expect(alCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('con el checkbox desmarcado agenda sin subtareas y el aviso no lleva paréntesis', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 1, fecha: HOY })])
    renderizar()
    await user.click(await screen.findByRole('checkbox', { name: /Incluir 2 subtareas/ }))

    await user.click(screen.getByRole('button', { name: 'Agendar «Armar la casa» para hoy' }))

    await waitFor(() => expect(avisos).toEqual(['«Armar la casa» agendada para hoy']))
    expect(agendarTarea).toHaveBeenCalledWith(1, { fecha: HOY, hoy: HOY, incluirSubtareas: false })
  })

  it('una raíz sin subtareas se agenda con incluirSubtareas false', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 4, fecha: HOY })])
    renderizar()
    await screen.findByText('Llamar al banco')

    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))

    await waitFor(() => expect(agendarTarea).toHaveBeenCalledWith(4, { fecha: HOY, hoy: HOY, incluirSubtareas: false }))
  })

  it('refresca la lista tras agendar', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 4, fecha: HOY })])
    renderizar()
    await screen.findByText('Llamar al banco')
    vi.mocked(getRecomendacion).mockResolvedValue([LISTA[0]!])

    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))

    await waitFor(() => expect(screen.queryByText('Llamar al banco')).not.toBeInTheDocument())
  })

  it('deshabilita los botones mientras agenda', async () => {
    const user = userEvent.setup()
    let terminar: (t: Tarea[]) => void = () => {}
    vi.mocked(agendarTarea).mockReturnValue(new Promise((resolver) => (terminar = resolver)))
    renderizar()
    await screen.findByText('Llamar al banco')

    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar «Armar la casa» para hoy' })).toBeDisabled())
    expect(screen.getByRole('checkbox')).toBeDisabled()
    terminar([tarea({ id: 4 })])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agendar «Armar la casa» para hoy' })).toBeEnabled())
  })

  it('muestra el 409 legible, sin avisar de éxito, y deja volver a intentar', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockRejectedValue(new ApiError(409, 'No se puede agendar una tarea cerrada'))
    renderizar()
    await screen.findByText('Llamar al banco')

    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede agendar una tarea cerrada')
    expect(avisos).toEqual([])
    expect(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' })).toBeEnabled()
  })

  it('muestra el 400 legible', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockRejectedValue(new ApiError(400, 'La fecha no puede ser anterior a hoy'))
    renderizar()
    await screen.findByText('Llamar al banco')

    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha no puede ser anterior a hoy')
  })
})

describe('RecomendacionDialog: próximos días', () => {
  const FUTURA = rec({ id: 7, titulo: 'Sacar turno', fecha: '2026-11-13', prioridad: 'MEDIA' })
  const interruptor = () => screen.getByRole('switch', { name: 'Incluir próximos N días' })
  const ultimosParams = () => vi.mocked(getRecomendacion).mock.lastCall![0]

  it('apagado no manda hasta', async () => {
    renderizar()
    await screen.findByText('Armar la casa')
    expect(interruptor()).not.toBeChecked()
    expect(ultimosParams().hasta).toBeUndefined()
    expect(screen.queryByRole('combobox', { name: 'Cantidad de días' })).not.toBeInTheDocument()
  })

  it('el interruptor se opera con el teclado y el selector solo aparece encendido', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    interruptor().focus()
    await user.keyboard(' ')
    expect(interruptor()).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Cantidad de días' })).toHaveValue('7')
    await waitFor(() => expect(ultimosParams().hasta).toBe('2026-11-17'))
    await user.keyboard(' ')
    expect(screen.queryByRole('combobox', { name: 'Cantidad de días' })).not.toBeInTheDocument()
    await waitFor(() => expect(ultimosParams().hasta).toBeUndefined())
  })

  it('cambiar a 14 y a 30 pide hasta = hoy + N', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    await user.click(interruptor())
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cantidad de días' }), '14')
    await waitFor(() => expect(ultimosParams().hasta).toBe('2026-11-24'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cantidad de días' }), '30')
    await waitFor(() => expect(ultimosParams().hasta).toBe('2026-12-10'))
  })

  it('mientras cambia el horizonte muestra «Cargando…» y no la lista anterior', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    vi.mocked(getRecomendacion).mockReturnValue(new Promise(() => {}))
    await user.click(interruptor())
    expect(await screen.findByText('Cargando recomendaciones…')).toBeInTheDocument()
    expect(screen.queryByText('Armar la casa')).not.toBeInTheDocument()
  })

  it('una fila futura dice «Para el viernes 13»; la atrasada y la sin fecha conservan su texto', async () => {
    vi.mocked(getRecomendacion).mockResolvedValue([...LISTA, FUTURA])
    renderizar()
    const fila = (await screen.findByText('Sacar turno')).closest('li')!
    expect(within(fila).getByText('Para el viernes 13')).toBeInTheDocument()
    expect(screen.getAllByText('Sin fecha').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Atrasada desde 3 de noviembre').length).toBeGreaterThan(0)
  })

  it('agendar una futura hace el PATCH correcto y la fila se va tras el refresco', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecomendacion).mockResolvedValue([FUTURA])
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 7, fecha: HOY })])
    renderizar()
    await screen.findByText('Sacar turno')
    vi.mocked(getRecomendacion).mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: 'Agendar «Sacar turno» para hoy' }))
    expect(agendarTarea).toHaveBeenCalledWith(7, { fecha: HOY, hoy: HOY, incluirSubtareas: false })
    await waitFor(() => expect(screen.queryByText('Sacar turno')).not.toBeInTheDocument())
  })

  it('una madre futura con una hija sin fecha muestra «Incluir 1 subtarea» y agendar manda incluirSubtareas=true', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecomendacion).mockResolvedValue([rec({ id: 8, titulo: 'Madre futura', fecha: '2026-11-15' }, [rec({ id: 9, titulo: 'Hija suelta', padreId: 8 })])])
    vi.mocked(agendarTarea).mockResolvedValue([tarea({ id: 8, fecha: HOY }), tarea({ id: 9, fecha: HOY })])
    renderizar()
    await screen.findByText('Madre futura')
    expect(screen.getByRole('checkbox', { name: /Incluir 1 subtarea/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Agendar «Madre futura» para hoy' }))
    expect(agendarTarea).toHaveBeenCalledWith(8, { fecha: HOY, hoy: HOY, incluirSubtareas: true })
  })

  it('vacío: sin horizonte el texto de siempre; con horizonte menciona los días', async () => {
    const user = userEvent.setup()
    vi.mocked(getRecomendacion).mockResolvedValue([])
    renderizar()
    expect(await screen.findByText('No hay tareas para recomendar')).toBeInTheDocument()
    await user.click(interruptor())
    expect(await screen.findByText('No hay tareas para recomendar ni para los próximos 7 días.')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cantidad de días' }), '30')
    expect(await screen.findByText('No hay tareas para recomendar ni para los próximos 30 días.')).toBeInTheDocument()
  })

  it('la descripción menciona el horizonte cuando está encendido', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    await user.click(interruptor())
    expect(screen.getByText(/o con fecha en los próximos 7 días/)).toBeInTheDocument()
  })

  it('convive con el filtro por proyecto: se mandan proyectoId y hasta juntos', async () => {
    const user = userEvent.setup()
    renderizar()
    await screen.findByText('Armar la casa')
    await user.click(interruptor())
    await user.click(screen.getByRole('button', { name: 'Proyecto' }))
    await user.click(await screen.findByRole('button', { name: 'Mudanza' }))
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ proyectoId: 10, hasta: '2026-11-17' })))
    // Mover el horizonte no suelta el filtro.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cantidad de días' }), '14')
    await waitFor(() => expect(getRecomendacion).toHaveBeenLastCalledWith(expect.objectContaining({ proyectoId: 10, hasta: '2026-11-24' })))
  })

  it('reabrir el diálogo lo deja apagado', async () => {
    const user = userEvent.setup()
    const { rerender, queryClient, alCerrar } = renderizar()
    await screen.findByText('Armar la casa')
    await user.click(interruptor())
    const con = (abierto: boolean) => (
      <QueryClientProvider client={queryClient}>
        <RecomendacionDialog abierto={abierto} alCerrar={alCerrar} hoy={HOY} aviso="" alAvisar={() => {}} />
      </QueryClientProvider>
    )
    rerender(con(false))
    rerender(con(true))
    await waitFor(() => expect(interruptor()).not.toBeChecked())
  })

  it('el interruptor y el selector se deshabilitan mientras se agenda', async () => {
    const user = userEvent.setup()
    vi.mocked(agendarTarea).mockReturnValue(new Promise(() => {}))
    renderizar()
    await screen.findByText('Armar la casa')
    await user.click(interruptor())
    await screen.findByText('Armar la casa')
    await user.click(screen.getByRole('button', { name: 'Agendar «Llamar al banco» para hoy' }))
    expect(interruptor()).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Cantidad de días' })).toBeDisabled()
  })
})
