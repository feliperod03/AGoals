import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { elementosPorDia } from './calendario'
import { VistaSemana } from './VistaSemana'

let siguienteId = 1

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

function evento(titulo: string, inicio: string, fin: string): Evento {
  return { id: siguienteId++, titulo, descripcion: null, fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null }
}

const SEMANA = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13']

interface Opciones {
  eventos?: Evento[]
  tareas?: Tarea[]
  dia?: string
  hoy?: string
  ahora?: Date
}

function montar({ eventos = [], tareas = [], dia = '2026-12-08', hoy = '2026-12-08', ahora = new Date('2026-12-08T10:30:00-03:00') }: Opciones = {}) {
  const alSeleccionar = vi.fn()
  const alSaltar = vi.fn()
  render(
    <>
      <h1 id="titulo">7–13 de diciembre de 2026</h1>
      <VistaSemana
        dias={SEMANA}
        dia={dia}
        hoy={hoy}
        ahora={ahora}
        elementosPorDia={elementosPorDia(SEMANA, eventos, tareas)}
        etiquetadaPor="titulo"
        alSeleccionar={alSeleccionar}
        alSaltar={alSaltar}
      />
    </>,
  )
  return { alSeleccionar, alSaltar }
}

const grilla = () => within(screen.getByTestId('semana-por-horas'))
const lista = () => within(screen.getByTestId('semana-en-lista'))
const dia = (nombre: RegExp) => within(grilla().getByRole('group', { name: nombre }))
const bloques = (nombre: RegExp) =>
  within(grilla().getByRole('group', { name: nombre }))
    .queryAllByTestId('bloque-semana')
    .map((b) => b.closest('li') as HTMLElement)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('VistaSemana: estructura y accesibilidad', () => {
  it('la semana lleva el nombre del título y siete días con su etiqueta completa', () => {
    montar({ tareas: [tarea({ titulo: 'Pagar' })] })
    expect(screen.getByRole('region', { name: '7–13 de diciembre de 2026' })).toBeInTheDocument()
    const grupos = grilla().getAllByRole('group')
    expect(grupos).toHaveLength(7)
    expect(grupos[0]).toHaveAccessibleName('lunes 7 de diciembre, sin elementos')
    expect(grupos[1]).toHaveAccessibleName('martes 8 de diciembre, hoy, 1 tarea')
  })

  it('el encabezado de cada día tiene un nombre corto (no repite la etiqueta del grupo)', () => {
    montar()
    const botones = grilla().getAllByRole('button')
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual([
      'lunes 7', 'martes 8', 'miércoles 9', 'jueves 10', 'viernes 11', 'sábado 12', 'domingo 13',
    ])
    expect(grilla().getByRole('button', { name: 'martes 8' })).toHaveAttribute('aria-current', 'date')
    expect(grilla().getByRole('button', { name: 'lunes 7' })).not.toHaveAttribute('aria-current')
  })

  it('solo el día seleccionado entra en el orden de Tab y está pulsado', () => {
    montar({ dia: '2026-12-10' })
    const conTab = grilla().getAllByRole('button').filter((b) => b.tabIndex === 0)
    expect(conTab.map((b) => b.getAttribute('aria-label'))).toEqual(['jueves 10'])
    expect(conTab[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('cada bloque se lee como una frase y su parte visual es decorativa', () => {
    montar({
      eventos: [evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')],
      tareas: [tarea({ titulo: 'Informe', horaInicio: '14:00:00', horaFin: '15:00:00', estado: 'EN_PROGRESO' })],
    })
    const martes = dia(/^martes 8/)
    expect(martes.getByText('Evento, 09:00–10:00, Reunión')).toBeInTheDocument()
    const frase = martes.getByText(/^Tarea, 14:00–15:00, .*Informe$/)
    expect(frase).toHaveTextContent('Tarea, 14:00–15:00, En progreso, Informe')
    for (const visual of martes.getAllByTestId('bloque-semana')) expect(visual).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('VistaSemana: franja «Sin hora»', () => {
  it('lleva las tareas sin hora y los eventos de 24 h o más (con flecha en los días de continuación)', () => {
    montar({
      eventos: [evento('Congreso', '2026-12-08T09:00:00-03:00', '2026-12-10T18:00:00-03:00')],
      tareas: [tarea({ titulo: 'Comprar regalos' })],
    })
    expect(grilla().getByText('Sin hora')).toBeInTheDocument()
    expect(dia(/^martes 8/).getByText(/^Tarea, sin hora, .*Comprar regalos$/)).toHaveTextContent('Tarea, sin hora, Pendiente, Comprar regalos')
    expect(dia(/^miércoles 9/).getByText('Evento, Todo el día, Congreso')).toBeInTheDocument()
    // El evento largo no es un bloque de la línea de tiempo.
    expect(bloques(/^miércoles 9/)).toHaveLength(0)
    // Continuación: el chip del 9 y del 10 lleva la flecha; el del 8 no.
    const chip = (nombre: RegExp) => dia(nombre).getByTitle(/^Congreso/)
    expect(chip(/^martes 8/).querySelector('svg')).toBeNull()
    expect(chip(/^miércoles 9/).querySelector('svg')).not.toBeNull()
    expect(chip(/^jueves 10/)).toHaveAttribute('title', 'Congreso — hasta 18:00')
  })

  it('sin nada sin hora en toda la semana no hay franja', () => {
    montar({ tareas: [tarea({ horaInicio: '09:00:00' })] })
    expect(grilla().queryByText('Sin hora')).not.toBeInTheDocument()
  })

  it('la HECHA se ve tachada y la CANCELADA no aparece', () => {
    montar({ tareas: [tarea({ titulo: 'Pagada', estado: 'HECHO' }), tarea({ titulo: 'Descartada', estado: 'CANCELADO' })] })
    const martes = dia(/^martes 8/)
    expect(martes.getByTitle('Pagada')).toHaveClass('text-mut')
    expect(screen.queryAllByText(/Descartada/)).toHaveLength(0)
  })
})

describe('VistaSemana: línea de tiempo', () => {
  it('rango 08–21 por defecto, con las horas en el eje', () => {
    montar()
    expect(grilla().getByText('08:00')).toBeInTheDocument()
    expect(grilla().getByText('21:00')).toBeInTheDocument()
    expect(grilla().queryByText('07:00')).not.toBeInTheDocument()
  })

  it('un evento que cruza la medianoche se corta en los dos días y estira el rango a 00–24', () => {
    montar({ eventos: [evento('Guardia', '2026-12-09T22:00:00-03:00', '2026-12-10T06:00:00-03:00')] })
    expect(grilla().getByText('00:00')).toBeInTheDocument()
    expect(grilla().getByText('23:00')).toBeInTheDocument()
    // El calendario nunca escribe «24:00»: el borde inferior del eje queda sin rótulo.
    expect(grilla().queryByText('24:00')).not.toBeInTheDocument()
    const [primero] = bloques(/^miércoles 9/)
    const [segundo] = bloques(/^jueves 10/)
    // 48 px por hora: 22:00 -> 1056 px; de 00:00 a 06:00 -> 288 px (menos 1 px de separación).
    expect(primero).toHaveStyle({ top: '1056px', height: '95px' })
    expect(segundo).toHaveStyle({ top: '0px', height: '287px' })
    const visualDelPrimero = within(primero as HTMLElement).getByTestId('bloque-semana')
    const visualDelSegundo = within(segundo as HTMLElement).getByTestId('bloque-semana')
    // El `title` va en la parte visual (oculta al lector), no en el `li`: así no se vuelve su nombre accesible.
    expect(visualDelPrimero).toHaveAttribute('title', 'EVENTO · desde 22:00 — Guardia')
    expect(visualDelSegundo).toHaveAttribute('title', 'EVENTO · hasta 06:00 — Guardia')
    expect(primero).not.toHaveAttribute('title')
    expect(segundo).not.toHaveAttribute('title')
    expect(visualDelPrimero).toHaveClass('rounded-b-none')
    expect(visualDelSegundo).toHaveClass('rounded-t-none')
    expect(visualDelSegundo.querySelector('svg')).not.toBeNull()
  })

  it('un evento de domingo a lunes solo muestra en esta semana el tramo del domingo', () => {
    montar({ eventos: [evento('Viaje', '2026-12-13T22:00:00-03:00', '2026-12-14T06:00:00-03:00')] })
    expect(bloques(/^domingo 13/)).toHaveLength(1)
    expect(within(bloques(/^domingo 13/)[0] as HTMLElement).getByTestId('bloque-semana')).toHaveAttribute('title', 'EVENTO · desde 22:00 — Viaje')
    expect(grilla().getAllByRole('group').flatMap((g) => within(g).queryAllByTestId('bloque-semana'))).toHaveLength(1)
  })

  it('los solapados se reparten la columna', () => {
    montar({
      eventos: [
        evento('A', '2026-12-08T09:00:00-03:00', '2026-12-08T11:00:00-03:00'),
        evento('B', '2026-12-08T10:00:00-03:00', '2026-12-08T12:00:00-03:00'),
      ],
    })
    const [a, b] = bloques(/^martes 8/)
    expect(a).toHaveStyle({ left: '0%' })
    expect(b).toHaveStyle({ left: '50%' })
  })

  it('una tarea HECHA con hora se tacha', () => {
    montar({ tareas: [tarea({ titulo: 'Lista', horaInicio: '09:00:00', horaFin: '10:00:00', estado: 'HECHO' })] })
    const [bloque] = bloques(/^martes 8/)
    const visual = within(bloque as HTMLElement).getByTestId('bloque-semana')
    expect(within(visual).getByText('Lista')).toHaveClass('line-through')
    expect(visual).toHaveClass('text-mut')
  })

  it('los niveles por ancho son container queries del propio bloque', () => {
    montar({
      tareas: [
        tarea({ titulo: 'Larga', horaInicio: '09:00:00', horaFin: '10:00:00' }),
        tarea({ titulo: 'Corta', horaInicio: '12:00:00', horaFin: '12:30:00' }),
      ],
    })
    const [larga, corta] = bloques(/^martes 8/).map((li) => within(li).getByTestId('bloque-semana'))
    expect(larga).toHaveClass('@container', 'flex-col', 'rounded-xl')
    expect(within(larga as HTMLElement).getByText('09:00')).toHaveClass('hidden', '@min-[56px]:inline')
    expect(corta).toHaveClass('@container', 'rounded-full')
    expect(within(corta as HTMLElement).getByText('12:00')).toHaveClass('hidden', '@min-[100px]:inline')
  })

  it('la línea de ahora solo está en la columna de hoy', () => {
    montar()
    expect(dia(/^martes 8/).getByTestId('linea-ahora')).toHaveAccessibleName('Ahora, 10:30')
    expect(screen.getAllByTestId('linea-ahora')).toHaveLength(1)
  })

  it('la línea de ahora no es un control y conserva su posición y su tamaño (sin pointer-events-none)', () => {
    montar()
    const linea = dia(/^martes 8/).getByTestId('linea-ahora')
    expect(linea).toHaveAttribute('role', 'img')
    expect(linea).not.toHaveAttribute('tabindex')
    expect(linea.querySelector('button, a, input')).toBeNull()
    // Posición: 10:30 con el rango 08–21 y 48 px por hora = 2,5 h × 48 = 120 px; tamaño: las mismas clases de antes.
    expect(linea).toHaveStyle({ top: '120px' })
    expect(linea).toHaveClass('absolute', '-right-px', '-left-1', 'z-10', 'flex', '-translate-y-1/2', 'items-center')
    expect(linea).not.toHaveClass('pointer-events-none')
    expect(linea).toHaveAttribute('data-bloque')
  })

  it('sin hoy en la semana, o con la hora fuera del rango, no hay línea de ahora', () => {
    montar({ hoy: '2026-11-10', ahora: new Date('2026-11-10T10:30:00-03:00') })
    expect(screen.queryByTestId('linea-ahora')).not.toBeInTheDocument()
  })

  it('a las 23:00 (fuera de 08–21) tampoco hay línea', () => {
    montar({ ahora: new Date('2026-12-08T23:00:00-03:00') })
    expect(screen.queryByTestId('linea-ahora')).not.toBeInTheDocument()
  })
})

describe('VistaSemana: teclado', () => {
  it('← → Inicio y Fin seleccionan dentro de la semana', async () => {
    const { alSeleccionar } = montar({ dia: '2026-12-09' })
    grilla().getByRole('button', { name: 'miércoles 9' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(alSeleccionar).toHaveBeenLastCalledWith('2026-12-10')
    await userEvent.keyboard('{ArrowLeft}')
    expect(alSeleccionar).toHaveBeenLastCalledWith('2026-12-08')
    await userEvent.keyboard('{Home}')
    expect(alSeleccionar).toHaveBeenLastCalledWith('2026-12-07')
    await userEvent.keyboard('{End}')
    expect(alSeleccionar).toHaveBeenLastCalledWith('2026-12-13')
  })

  it('salir por el lunes o el domingo y RePág/AvPág saltan a otra semana', async () => {
    const { alSaltar, alSeleccionar } = montar({ dia: '2026-12-07' })
    grilla().getByRole('button', { name: 'lunes 7' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(alSaltar).toHaveBeenLastCalledWith('2026-12-06')
    await userEvent.keyboard('{PageDown}')
    expect(alSaltar).toHaveBeenLastCalledWith('2026-12-14')
    await userEvent.keyboard('{PageUp}')
    expect(alSaltar).toHaveBeenLastCalledWith('2026-11-30')
    await userEvent.keyboard('{ArrowUp}{a}')
    expect(alSaltar).toHaveBeenCalledTimes(3)
    expect(alSeleccionar).not.toHaveBeenCalled()
  })

  it('un clic en el encabezado selecciona ese día', async () => {
    const { alSeleccionar } = montar()
    await userEvent.click(grilla().getByRole('button', { name: 'viernes 11' }))
    expect(alSeleccionar).toHaveBeenCalledWith('2026-12-11')
  })
})

describe('VistaSemana: variantes por ancho', () => {
  it('la grilla se muestra desde 560 px y la lista por debajo (container query)', () => {
    montar()
    expect(screen.getByTestId('semana-por-horas')).toHaveClass('hidden', '@min-[560px]:flex')
    expect(screen.getByTestId('semana-en-lista')).toHaveClass('@min-[560px]:hidden')
  })

  it('la lista tiene una sección por día con sus filas, y «Nada para este día.» si está vacío', () => {
    montar({
      eventos: [evento('Reunión', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')],
      tareas: [tarea({ titulo: 'Pagar' })],
    })
    const secciones = lista().getAllByRole('region')
    expect(secciones).toHaveLength(7)
    const martes = within(lista().getByRole('region', { name: /^martes 8 de diciembre/ }))
    expect(martes.getByText('hoy')).toBeInTheDocument()
    expect(martes.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Reunión'),
      expect.stringContaining('Pagar'),
    ])
    expect(within(lista().getByRole('region', { name: 'lunes 7 de diciembre' })).getByText('Nada para este día.')).toBeInTheDocument()
  })
})
