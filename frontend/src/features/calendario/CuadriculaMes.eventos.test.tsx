import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { diasDeLaCuadricula, elementosPorDia } from './calendario'
import { CuadriculaMes } from './CuadriculaMes'

// Atajo de mouse en los chips del mes (9c, P2): el botón del día sigue siendo uno por celda.

const HOY = '2026-11-10'

function evento(id: number, titulo: string, inicio: string, fin: string): Evento {
  return { id, titulo, descripcion: '', fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null }
}

function tarea(id: number, titulo: string, fecha: string): Tarea {
  return {
    id,
    titulo,
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha,
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
  }
}

const REUNION = evento(1, 'Reunión', '2026-11-15T09:00:00-03:00', '2026-11-15T10:00:00-03:00')
const CONGRESO = evento(2, 'Congreso', '2026-11-02T09:00:00-03:00', '2026-11-04T18:00:00-03:00')

function montar({ eventos = [REUNION, CONGRESO], tareas = [] as Tarea[], conAtajo = true } = {}) {
  const alSeleccionar = vi.fn()
  const alAbrirEvento = vi.fn()
  render(
    <>
      <h1 id="titulo">Mes</h1>
      <CuadriculaMes
        mes="2026-11"
        hoy={HOY}
        dia={HOY}
        elementosPorDia={elementosPorDia(diasDeLaCuadricula('2026-11'), eventos, tareas)}
        etiquetadaPor="titulo"
        alSeleccionar={alSeleccionar}
        alSaltar={vi.fn()}
        alAbrirEvento={conAtajo ? alAbrirEvento : undefined}
      />
    </>,
  )
  return { alSeleccionar, alAbrirEvento }
}

const celda = (etiqueta: RegExp) => screen.getByRole('button', { name: etiqueta })
/** El chip de un evento en la variante ancha (la que lleva `data-evento-id`). */
const chip = (etiqueta: RegExp, id: number) => celda(etiqueta).querySelector(`[data-evento-id="${id}"]`) as HTMLElement

describe('CuadriculaMes: atajo de mouse en los chips', () => {
  it('clic en el chip de un evento selecciona su día y abre ese evento', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar()
    await user.click(chip(/^domingo 15 de noviembre/, 1))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-15')
    expect(alAbrirEvento).toHaveBeenCalledTimes(1)
    expect(alAbrirEvento).toHaveBeenCalledWith(REUNION)
  })

  it('clic en un hijo del chip (el título) también lo abre', async () => {
    const user = userEvent.setup()
    const { alAbrirEvento } = montar()
    await user.click(within(chip(/^domingo 15 de noviembre/, 1)).getByText('Reunión'))
    expect(alAbrirEvento).toHaveBeenCalledWith(REUNION)
  })

  it('desde el día 2 de un evento de varios días abre el mismo evento completo', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar()
    await user.click(chip(/^martes 3 de noviembre/, 2))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-03')
    expect(alAbrirEvento).toHaveBeenCalledWith(CONGRESO)
  })

  it('clic en el número o en el espacio vacío de la celda: solo selecciona', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar()
    await user.click(within(celda(/^domingo 15 de noviembre/)).getByText('15'))
    await user.click(celda(/^domingo 15 de noviembre/))
    expect(alSeleccionar).toHaveBeenCalledTimes(2)
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('clic en una tarea: solo selecciona', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar({ tareas: [tarea(30, 'Pagar la luz', '2026-11-15')] })
    const cel = celda(/^domingo 15 de noviembre/)
    const chipTarea = within(cel).getAllByText('Pagar la luz')[0] as HTMLElement
    await user.click(chipTarea)
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-15')
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('clic en «+N más»: solo selecciona', async () => {
    const user = userEvent.setup()
    const muchos = [1, 2, 3, 4].map((i) => evento(10 + i, `E${i}`, `2026-11-20T0${i}:00:00-03:00`, `2026-11-20T0${i}:30:00-03:00`))
    const { alSeleccionar, alAbrirEvento } = montar({ eventos: muchos })
    await user.click(within(celda(/^viernes 20 de noviembre/)).getByText('+2'))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-20')
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('en la variante angosta (marcas de ~10 px, sin data-evento-id) el clic solo selecciona', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar()
    const cel = celda(/^domingo 15 de noviembre/)
    const marca = cel.querySelector('span[aria-hidden="true"] > .bg-evento') as HTMLElement
    expect(marca).not.toBeNull()
    expect(marca.closest('[data-evento-id]')).toBeNull()
    await user.click(marca)
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-15')
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('con el teclado (Enter sobre el botón del día) solo selecciona', () => {
    const { alSeleccionar, alAbrirEvento } = montar()
    // Enter dispara `click` con destino en el propio botón, no en un chip.
    fireEvent.click(celda(/^domingo 15 de noviembre/))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-15')
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('sin la prop el chip solo selecciona (como en 9a)', async () => {
    const user = userEvent.setup()
    const { alSeleccionar, alAbrirEvento } = montar({ conAtajo: false })
    await user.click(chip(/^domingo 15 de noviembre/, 1))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-15')
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('sigue habiendo un solo botón por celda y la etiqueta del día no cambia', () => {
    montar()
    for (const gridcell of screen.getAllByRole('gridcell')) {
      expect(within(gridcell).getAllByRole('button')).toHaveLength(1)
    }
    expect(celda(/^domingo 15 de noviembre/)).toHaveAccessibleName('domingo 15 de noviembre, 1 evento')
  })
})
