import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { diasDeLaCuadricula, elementosPorDia } from './calendario'
import { CuadriculaMes } from './CuadriculaMes'

const HOY = '2026-11-10'

function tarea(id: number, titulo: string, fecha: string, extra: Partial<Tarea> = {}): Tarea {
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
    ...extra,
  }
}

function montar(opciones: { mes?: string; dia?: string; tareas?: Tarea[]; eventos?: Evento[] } = {}) {
  const mes = opciones.mes ?? '2026-11'
  const alSeleccionar = vi.fn()
  const alSaltar = vi.fn()
  const datos = elementosPorDia(diasDeLaCuadricula(mes), opciones.eventos ?? [], opciones.tareas ?? [])
  render(
    <>
      <h1 id="titulo">Mes</h1>
      <CuadriculaMes
        mes={mes}
        hoy={HOY}
        dia={opciones.dia ?? HOY}
        elementosPorDia={datos}
        etiquetadaPor="titulo"
        alSeleccionar={alSeleccionar}
        alSaltar={alSaltar}
      />
    </>,
  )
  return { alSeleccionar, alSaltar }
}

const celda = (etiqueta: RegExp | string) => screen.getByRole('button', { name: etiqueta })

describe('CuadriculaMes: estructura', () => {
  it('es un grid con nombre, una fila de encabezados y una fila por semana', () => {
    montar()
    const grid = screen.getByRole('grid', { name: 'Mes' })
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7)
    // 1 fila de encabezados + 6 semanas de noviembre de 2026.
    expect(within(grid).getAllByRole('row')).toHaveLength(7)
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42)
  })

  it('los encabezados empiezan en lunes y llevan el nombre completo', () => {
    montar()
    const encabezados = screen.getAllByRole('columnheader')
    expect(encabezados[0]).toHaveTextContent('lun')
    expect(within(encabezados[0] as HTMLElement).getByText('lun')).toHaveAttribute('title', 'lunes')
    expect(encabezados[6]).toHaveTextContent('dom')
  })

  it('cada día tiene una etiqueta completa, con hoy y los conteos', () => {
    montar({ tareas: [tarea(1, 'A', HOY), tarea(2, 'B', HOY), tarea(3, 'C', HOY)] })
    expect(celda('martes 10 de noviembre, hoy, 3 tareas')).toHaveAttribute('aria-current', 'date')
    expect(celda('miércoles 11 de noviembre, sin elementos')).not.toHaveAttribute('aria-current')
  })

  it('marca la celda seleccionada con aria-selected', () => {
    montar({ dia: '2026-11-14' })
    const seleccionadas = screen.getAllByRole('gridcell').filter((c) => c.getAttribute('aria-selected') === 'true')
    expect(seleccionadas).toHaveLength(1)
    expect(within(seleccionadas[0] as HTMLElement).getByRole('button')).toHaveAccessibleName(/sábado 14 de noviembre/)
  })

  it('tabindex itinerante: solo el día seleccionado entra en el orden de Tab', () => {
    montar()
    const botones = screen.getAllByRole('button')
    expect(botones).toHaveLength(42)
    const enfocables = botones.filter((b) => b.tabIndex === 0)
    expect(enfocables).toHaveLength(1)
    expect(enfocables[0]).toHaveAccessibleName(/martes 10 de noviembre/)
  })

  it('incluye los días de los meses vecinos', () => {
    montar()
    expect(celda(/lunes 26 de octubre/)).toBeInTheDocument()
    expect(celda(/domingo 6 de diciembre/)).toBeInTheDocument()
  })
})

describe('CuadriculaMes: contenido de las celdas', () => {
  it('con 4 o más elementos muestra 2 y un único «+N más»', () => {
    montar({ tareas: [1, 2, 3, 4].map((n) => tarea(n, `Tarea ${n}`, HOY)) })
    const boton = celda(/martes 10 de noviembre/)
    expect(within(boton).getByText('Tarea 1')).toBeInTheDocument()
    expect(within(boton).getByText('Tarea 2')).toBeInTheDocument()
    expect(within(boton).queryByText('Tarea 3')).not.toBeInTheDocument()
    // Un solo elemento «+N»; la palabra «más» es un hijo que solo se ve desde 640 px (aquí no hay CSS).
    expect(within(boton).getAllByText('+2')).toHaveLength(1)
    expect(boton).toHaveTextContent('+2 más')
    expect(within(boton).getByText('más')).toHaveClass('hidden', '@min-[640px]:inline')
  })

  it('con 3 elementos los muestra todos, sin «+N más»', () => {
    montar({ tareas: [1, 2, 3].map((n) => tarea(n, `Tarea ${n}`, HOY)) })
    const boton = celda(/martes 10 de noviembre/)
    expect(within(boton).getByText('Tarea 3')).toBeInTheDocument()
    expect(within(boton).queryByText(/^\+\d+/)).not.toBeInTheDocument()
    expect(boton).not.toHaveTextContent('más')
  })

  it('cada título aparece una sola vez: las marcas de la variante angosta no tienen texto y están ocultas', () => {
    montar({ tareas: [tarea(1, 'Pagar luz', HOY)] })
    const boton = celda(/martes 10 de noviembre/)
    expect(within(boton).getAllByText('Pagar luz')).toHaveLength(1)
    // El bloque de marcas es el hijo directo del botón con aria-hidden (los íconos de los chips también lo llevan).
    const marcas = Array.from(boton.children).find((hijo) => hijo.getAttribute('aria-hidden') === 'true')
    expect(marcas).toBeDefined()
    expect(marcas?.textContent).toBe('')
    expect(marcas?.children).toHaveLength(1)
  })

  it('una tarea HECHA se ve tachada y una CANCELADA no se ve', () => {
    montar({ tareas: [tarea(1, 'Hecha', HOY, { estado: 'HECHO' }), tarea(2, 'Cancelada', HOY, { estado: 'CANCELADO' })] })
    expect(screen.getByText('Hecha')).toHaveClass('line-through')
    expect(screen.queryByText('Cancelada')).not.toBeInTheDocument()
  })

  describe('evento que cruza la medianoche', () => {
    const guardia: Evento = {
      id: 7,
      titulo: 'Guardia',
      descripcion: null,
      fechaHoraInicio: '2026-11-09T22:00:00-03:00',
      fechaHoraFin: '2026-11-10T06:00:00-03:00',
      prioridad: null,
    }

    it('el primer día lleva la hora de inicio; el día de continuación solo flecha y título', () => {
      montar({ eventos: [guardia] })
      const primero = celda(/lunes 9 de noviembre/)
      expect(within(primero).getByText('22:00')).toBeInTheDocument()
      expect(within(primero).getByText('Guardia')).toBeInTheDocument()
      const continuacion = celda(/martes 10 de noviembre/)
      expect(within(continuacion).getByText('Guardia')).toBeInTheDocument()
      expect(continuacion).not.toHaveTextContent(/hasta|\d{2}:\d{2}/)
    })

    it('el «hasta» y el «desde» van en el title del chip, junto al título', () => {
      montar({ eventos: [guardia] })
      expect(within(celda(/lunes 9 de noviembre/)).getByTitle('Guardia — desde 22:00')).toBeInTheDocument()
      expect(within(celda(/martes 10 de noviembre/)).getByTitle('Guardia — hasta 06:00')).toBeInTheDocument()
    })

    it('el día intermedio de uno de tres días dice «Todo el día» en el title', () => {
      montar({
        eventos: [{ ...guardia, fechaHoraInicio: '2026-11-09T22:00:00-03:00', fechaHoraFin: '2026-11-11T06:00:00-03:00' }],
      })
      const medio = celda(/martes 10 de noviembre/)
      expect(within(medio).getByTitle('Guardia — Todo el día')).toBeInTheDocument()
      expect(medio).not.toHaveTextContent('Todo el día')
    })
  })

  it('el title de un evento normal y el de una tarea con hora incluyen su rango; el de una tarea sin hora, solo el título', () => {
    montar({
      eventos: [{ id: 8, titulo: 'Reunión', descripcion: null, fechaHoraInicio: '2026-11-10T09:00:00-03:00', fechaHoraFin: '2026-11-10T10:00:00-03:00', prioridad: null }],
      tareas: [tarea(1, 'Llamar', HOY, { horaInicio: '12:45:00', horaFin: '13:30:00' }), tarea(2, 'Sin hora', HOY)],
    })
    const boton = celda(/martes 10 de noviembre/)
    expect(within(boton).getByTitle('Reunión — 09:00–10:00')).toBeInTheDocument()
    expect(within(boton).getByTitle('Llamar — 12:45–13:30')).toBeInTheDocument()
    expect(within(boton).getByTitle('Sin hora')).toBeInTheDocument()
  })

  it('la hora del chip solo se ve con la cuadrícula ancha (980 px) y el chip es uno solo para todos los anchos', () => {
    montar({ tareas: [tarea(1, 'Llamar', HOY, { horaInicio: '12:45:00', horaFin: '13:30:00' })] })
    const boton = celda(/martes 10 de noviembre/)
    expect(within(boton).getByText('12:45')).toHaveClass('hidden', '@min-[980px]:inline')
    expect(within(boton).getAllByText('Llamar')).toHaveLength(1)
  })
})

describe('CuadriculaMes: interacción', () => {
  it('un clic en un día lo elige', async () => {
    const { alSeleccionar } = montar()
    await userEvent.click(celda(/sábado 14 de noviembre/))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-11-14')
  })

  it('un clic en un día de otro mes visible también solo lo elige (sin saltar)', async () => {
    const { alSeleccionar, alSaltar } = montar()
    await userEvent.click(celda(/jueves 29 de octubre/))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-10-29')
    expect(alSaltar).not.toHaveBeenCalled()
  })

  it.each([
    ['{ArrowRight}', '2026-11-11'],
    ['{ArrowLeft}', '2026-11-09'],
    ['{ArrowDown}', '2026-11-17'],
    ['{ArrowUp}', '2026-11-03'],
    ['{Home}', '2026-11-09'],
    ['{End}', '2026-11-15'],
  ])('%s elige %s dentro de la cuadrícula', async (tecla, esperado) => {
    const { alSeleccionar, alSaltar } = montar()
    celda(/martes 10 de noviembre/).focus()
    await userEvent.keyboard(tecla)
    expect(alSeleccionar).toHaveBeenCalledWith(esperado)
    expect(alSaltar).not.toHaveBeenCalled()
  })

  it('una tecla que lleva fuera de la cuadrícula salta (cambia de mes)', async () => {
    const { alSeleccionar, alSaltar } = montar({ dia: '2026-11-30' })
    celda(/lunes 30 de noviembre/).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(alSaltar).toHaveBeenCalledWith('2026-12-07')
    expect(alSeleccionar).not.toHaveBeenCalled()
  })

  it('RePág y AvPág van al mismo día del mes anterior y siguiente: fuera de la cuadrícula, saltan', async () => {
    const { alSaltar } = montar({ dia: '2026-11-20' })
    celda(/viernes 20 de noviembre/).focus()
    await userEvent.keyboard('{PageDown}')
    await userEvent.keyboard('{PageUp}')
    expect(alSaltar).toHaveBeenNthCalledWith(1, '2026-12-20')
    expect(alSaltar).toHaveBeenNthCalledWith(2, '2026-10-20')
  })

  it('con Alt o Ctrl no interviene (son atajos del navegador)', async () => {
    const { alSeleccionar, alSaltar } = montar()
    celda(/martes 10 de noviembre/).focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await userEvent.keyboard('{Control>}{Home}{/Control}')
    expect(alSeleccionar).not.toHaveBeenCalled()
    expect(alSaltar).not.toHaveBeenCalled()
  })

  it('el foco pasa al día elegido con el teclado', async () => {
    const { rerender } = (() => {
      const alSeleccionar = vi.fn()
      const props = {
        mes: '2026-11',
        hoy: HOY,
        elementosPorDia: elementosPorDia(diasDeLaCuadricula('2026-11'), [], []),
        etiquetadaPor: 'titulo',
        alSeleccionar,
        alSaltar: vi.fn(),
      }
      const r = render(<CuadriculaMes {...props} dia={HOY} />)
      return { rerender: (dia: string) => r.rerender(<CuadriculaMes {...props} dia={dia} />) }
    })()
    celda(/martes 10 de noviembre/).focus()
    await userEvent.keyboard('{ArrowRight}')
    // El padre real cambia `dia` tras alSeleccionar; aquí lo simulamos.
    rerender('2026-11-11')
    expect(celda(/miércoles 11 de noviembre/)).toHaveFocus()
  })
})
