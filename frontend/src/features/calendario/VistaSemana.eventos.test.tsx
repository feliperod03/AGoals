import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { elementosPorDia } from './calendario'
import { VistaSemana } from './VistaSemana'

// 9c en la semana: los eventos abren su edición (botón vacío hermano del dibujo) y un clic en un hueco crea.

let siguienteId = 100

function evento(titulo: string, inicio: string, fin: string): Evento {
  return { id: siguienteId++, titulo, descripcion: '', fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null }
}

function tarea(extra: Partial<Tarea> = {}): Tarea {
  return {
    id: siguienteId++,
    titulo: 'Tarea',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: '2026-12-08',
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...extra,
  }
}

const SEMANA = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13']

function montar({ eventos = [] as Evento[], tareas = [] as Tarea[] } = {}) {
  const alAbrirEvento = vi.fn()
  const alCrearEnHueco = vi.fn()
  const alSeleccionar = vi.fn()
  render(
    <>
      <h1 id="titulo">Semana</h1>
      <VistaSemana
        dias={SEMANA}
        dia="2026-12-08"
        hoy="2026-12-08"
        ahora={new Date('2026-12-08T10:30:00-03:00')}
        elementosPorDia={elementosPorDia(SEMANA, eventos, tareas)}
        etiquetadaPor="titulo"
        alSeleccionar={alSeleccionar}
        alSaltar={vi.fn()}
        alAbrirEvento={alAbrirEvento}
        alCrearEnHueco={alCrearEnHueco}
      />
    </>,
  )
  return { alAbrirEvento, alCrearEnHueco, alSeleccionar }
}

const grilla = () => within(screen.getByTestId('semana-por-horas'))
const lista = () => within(screen.getByTestId('semana-en-lista'))
const columna = (nombre: RegExp) => grilla().getByRole('group', { name: nombre })
/** La línea de tiempo de un día, con su borde superior simulado en y = 0. */
function lineaDe(nombre: RegExp) {
  const linea = within(columna(nombre)).getByTestId('linea-de-tiempo')
  linea.getBoundingClientRect = () => ({ top: 0, left: 0, right: 100, bottom: 1000, width: 100, height: 1000, x: 0, y: 0, toJSON: () => ({}) })
  return linea
}

describe('VistaSemana: editar eventos', () => {
  it('un bloque de evento es un botón «Editar evento: …» que abre ese evento', async () => {
    const user = userEvent.setup()
    const reunion = evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')
    const { alAbrirEvento, alCrearEnHueco } = montar({ eventos: [reunion] })
    await user.click(grilla().getByRole('button', { name: 'Editar evento: Reunión, 09:00–10:00' }))
    expect(alAbrirEvento).toHaveBeenCalledWith(reunion)
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })

  it('las tareas no tienen botón y un clic sobre su bloque no hace nada', async () => {
    const user = userEvent.setup()
    const { alAbrirEvento, alCrearEnHueco } = montar({ tareas: [tarea({ titulo: 'Informe', horaInicio: '14:00:00', horaFin: '15:00:00' })] })
    expect(grilla().queryByRole('button', { name: /Informe/ })).not.toBeInTheDocument()
    await user.click(within(columna(/^martes 8/)).getByTitle(/Informe/))
    expect(alAbrirEvento).not.toHaveBeenCalled()
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })

  it('un evento de varios días da un botón por día (línea de tiempo y franja) y todos abren el mismo evento', async () => {
    const user = userEvent.setup()
    const viaje = evento('Viaje', '2026-12-08T20:00:00-03:00', '2026-12-10T10:00:00-03:00')
    const { alAbrirEvento } = montar({ eventos: [viaje] })
    const botones = grilla().getAllByRole('button', { name: /^Editar evento: Viaje/ })
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar evento: Viaje, desde 20:00',
      'Editar evento: Viaje, Todo el día',
      'Editar evento: Viaje, hasta 10:00',
    ])
    for (const boton of botones) await user.click(boton)
    expect(alAbrirEvento).toHaveBeenCalledTimes(3)
    for (const llamada of alAbrirEvento.mock.calls) expect(llamada[0]).toBe(viaje)
  })

  it('el botón es vacío y hermano del dibujo, que sigue aria-hidden con su title', () => {
    montar({ eventos: [evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')] })
    const boton = grilla().getByRole('button', { name: /^Editar evento: Reunión/ })
    expect(boton).toBeEmptyDOMElement()
    const dibujo = boton.parentElement?.querySelector('[data-testid="bloque-semana"]') as HTMLElement
    expect(dibujo).toHaveAttribute('aria-hidden', 'true')
    expect(dibujo).toHaveAttribute('title')
    expect(screen.getByTestId('semana-por-horas').querySelectorAll('button div')).toHaveLength(0)
  })

  it('en la lista angosta las filas de evento también abren la edición', async () => {
    const user = userEvent.setup()
    const reunion = evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')
    const { alAbrirEvento } = montar({ eventos: [reunion] })
    await user.click(lista().getByRole('button', { name: 'Editar evento: Reunión, 09:00–10:00' }))
    expect(alAbrirEvento).toHaveBeenCalledWith(reunion)
  })
})

describe('VistaSemana: crear con un clic en un hueco', () => {
  it('clic en el hueco del martes a la altura de las 10:00 (rango 08–21, y = 96)', () => {
    const { alCrearEnHueco } = montar()
    fireEvent.click(lineaDe(/^martes 8/), { clientY: 96 })
    expect(alCrearEnHueco).toHaveBeenCalledWith('2026-12-08', 600)
  })

  it('redondea hacia abajo a la media hora (10:29 → 10:00; 10:30 → 10:30)', () => {
    const { alCrearEnHueco } = montar()
    fireEvent.click(lineaDe(/^jueves 10/), { clientY: 96 + 23 })
    fireEvent.click(lineaDe(/^jueves 10/), { clientY: 96 + 24 })
    expect(alCrearEnHueco.mock.calls).toEqual([
      ['2026-12-10', 600],
      ['2026-12-10', 630],
    ])
  })

  it('con el rango extendido hasta las 24, un clic abajo del todo da 23:30', () => {
    const { alCrearEnHueco } = montar({ eventos: [evento('Guardia', '2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00')] })
    // Rango 00–24 (la guardia cruza la medianoche): 23:40 está a 23,67 h × 48 px.
    fireEvent.click(lineaDe(/^lunes 7/), { clientY: 23.67 * 48 })
    expect(alCrearEnHueco).toHaveBeenCalledWith('2026-12-07', 23 * 60 + 30)
  })

  it('clic sobre un bloque de evento abre la edición y NO la creación', async () => {
    const user = userEvent.setup()
    const { alAbrirEvento, alCrearEnHueco } = montar({ eventos: [evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')] })
    lineaDe(/^martes 8/)
    await user.click(grilla().getByRole('button', { name: /^Editar evento: Reunión/ }))
    expect(alAbrirEvento).toHaveBeenCalledTimes(1)
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })

  it('clic en el encabezado del día: solo selecciona', async () => {
    const user = userEvent.setup()
    const { alCrearEnHueco, alSeleccionar } = montar()
    await user.click(grilla().getByRole('button', { name: 'miércoles 9' }))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-12-09')
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })

  it('un hueco de la franja «Sin hora» crea un evento de todo el día (minutos = null)', () => {
    const { alCrearEnHueco } = montar({ tareas: [tarea({ titulo: 'Comprar regalos' })] })
    fireEvent.click(within(columna(/^viernes 11/)).getByTestId('franja-sin-hora'))
    expect(alCrearEnHueco).toHaveBeenCalledWith('2026-12-11', null)
  })

  it('clic sobre una tarea de la franja: no se abre nada', async () => {
    const user = userEvent.setup()
    const { alCrearEnHueco, alAbrirEvento } = montar({ tareas: [tarea({ titulo: 'Comprar regalos' })] })
    await user.click(within(columna(/^martes 8/)).getByTitle('Comprar regalos'))
    expect(alCrearEnHueco).not.toHaveBeenCalled()
    expect(alAbrirEvento).not.toHaveBeenCalled()
  })

  it('clic sobre un evento de la franja abre la edición, no la creación', async () => {
    const user = userEvent.setup()
    const feriado = evento('Feriado', '2026-12-08T00:00:00-03:00', '2026-12-09T00:00:00-03:00')
    const { alCrearEnHueco, alAbrirEvento } = montar({ eventos: [feriado] })
    await user.click(grilla().getByRole('button', { name: 'Editar evento: Feriado, Todo el día' }))
    expect(alAbrirEvento).toHaveBeenCalledWith(feriado)
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })

  it('la línea de tiempo no es un control: sin role, sin tabIndex y fuera del orden de Tab', () => {
    montar()
    const linea = lineaDe(/^martes 8/)
    expect(linea).not.toHaveAttribute('role')
    expect(linea).not.toHaveAttribute('tabindex')
  })

  it('la lista angosta no tiene clic para crear', () => {
    const { alCrearEnHueco } = montar()
    expect(lista().queryByTestId('linea-de-tiempo')).not.toBeInTheDocument()
    fireEvent.click(lista().getAllByRole('heading')[1] as HTMLElement)
    fireEvent.click(lista().getAllByText('Nada para este día.')[0] as HTMLElement)
    expect(alCrearEnHueco).not.toHaveBeenCalled()
  })
})

describe('VistaSemana: la línea de «ahora» no crea eventos (H1)', () => {
  it('clic sobre la línea de ahora, su punto o su trazo: no se abre nada ni se llama a alCrearEnHueco', async () => {
    const user = userEvent.setup()
    const { alCrearEnHueco, alAbrirEvento, alSeleccionar } = montar()
    const linea = within(columna(/^martes 8/)).getByTestId('linea-ahora')
    await user.click(linea)
    for (const parte of Array.from(linea.children)) await user.click(parte as HTMLElement)
    expect(alCrearEnHueco).not.toHaveBeenCalled()
    expect(alAbrirEvento).not.toHaveBeenCalled()
    expect(alSeleccionar).not.toHaveBeenCalled()
  })

  it('el clic en un hueco cercano sigue creando', () => {
    const { alCrearEnHueco } = montar()
    const l = lineaDe(/^martes 8/)
    fireEvent.click(l, { clientY: 96 })
    expect(alCrearEnHueco).toHaveBeenCalledWith('2026-12-08', 600)
  })
})
