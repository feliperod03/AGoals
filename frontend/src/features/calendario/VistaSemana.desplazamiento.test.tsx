import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { diasDeLaSemana } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Tarea } from '@/types/tarea'
import { elementosPorDia } from './calendario'
import { VistaSemana } from './VistaSemana'

// H-30 (la semana se abre en la zona útil) y H-31 (texto completo en los bloques y chips).

let siguienteId = 1

function evento(titulo: string, inicio: string, fin: string): Evento {
  return { id: siguienteId++, titulo, descripcion: null, fechaHoraInicio: inicio, fechaHoraFin: fin, prioridad: null, serieId: null }
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

const SEMANA = diasDeLaSemana('2026-12-08') // lun 7 – dom 13
const SIGUIENTE = diasDeLaSemana('2026-12-15') // lun 14 – dom 20

interface Opciones {
  dias?: string[]
  hoy?: string
  ahora?: Date
  eventos?: Evento[]
  tareas?: Tarea[]
  listo?: boolean
}

function vista({ dias = SEMANA, hoy = '2026-12-08', ahora = new Date('2026-12-08T15:10:00-03:00'), eventos = [], tareas = [], listo = true }: Opciones = {}) {
  return (
    <>
      <h1 id="titulo">Semana</h1>
      <VistaSemana
        dias={dias}
        dia={dias[0] as string}
        hoy={hoy}
        ahora={ahora}
        elementosPorDia={elementosPorDia(dias, eventos, tareas)}
        etiquetadaPor="titulo"
        alSeleccionar={vi.fn()}
        alSaltar={vi.fn()}
        alAbrirEvento={vi.fn()}
        listo={listo}
      />
    </>
  )
}

const scrollTo = vi.mocked(window.scrollTo)

beforeEach(() => scrollTo.mockClear())
afterEach(() => document.documentElement.style.removeProperty('--alto-vencidos'))

describe('VistaSemana: desplazamiento inicial (H-30)', () => {
  // En jsdom la línea de tiempo está en y = 0: top = (hora − 08:00)·48 px − cabecera (56) − holgura (8).
  it('la semana de hoy se abre en la hora actual (con una hora de contexto), al instante', () => {
    render(vista())
    // 15:10 → mira desde las 14:10: 6 h 10 min bajo las 08:00 = 296 px; − 56 − 8.
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 232, behavior: 'auto' })
  })

  it('otra semana se abre en su primer evento con hora', () => {
    const tarde = evento('Tarde', '2026-12-16T15:00:00-03:00', '2026-12-16T16:00:00-03:00')
    const noche = evento('Noche', '2026-12-17T22:00:00-03:00', '2026-12-18T02:00:00-03:00')
    render(vista({ dias: SIGUIENTE, eventos: [tarde, noche] }))
    // Rango 00–24 por la guardia nocturna; 15:00 → desde las 14:00 = 14 h × 48 = 672; − 64.
    expect(scrollTo).toHaveBeenCalledWith({ top: 608, behavior: 'auto' })
  })

  it('una semana sin nada con hora se abre hacia las 08:00', () => {
    render(vista({ dias: SIGUIENTE, tareas: [tarea({ fecha: '2026-12-16' })] }))
    // Rango 08–21: las 08:00 con su hora de contexto quedan en el borde superior (0 px) → no baja de 0.
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('si lo útil está al principio de la rejilla, sube hasta arriba del todo en vez de esconder los controles', () => {
    // La rejilla empieza 300 px más abajo (título y controles de la página): sin la regla iría a 300 − 64 = 236.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 300 } as DOMRect)
    render(vista({ dias: SIGUIENTE, tareas: [tarea({ fecha: '2026-12-16' })] }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    rect.mockRestore()
  })

  it('espera a que los datos de la semana estén listos', () => {
    const { rerender } = render(vista({ listo: false }))
    expect(scrollTo).not.toHaveBeenCalled()
    rerender(vista({ listo: true }))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('al cambiar de semana vuelve a desplazar, con las reglas de esa semana', () => {
    const tarde = evento('Tarde', '2026-12-16T15:00:00-03:00', '2026-12-16T16:00:00-03:00')
    const { rerender } = render(vista())
    scrollTo.mockClear()
    rerender(vista({ dias: SIGUIENTE, eventos: [tarde] }))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // Rango 08–21 (la tarde no lo cambia): 15:00 → desde las 14:00 = 6 h × 48 = 288; − 64.
    expect(scrollTo).toHaveBeenCalledWith({ top: 224, behavior: 'auto' })
  })

  it('NO vuelve a desplazar cuando solo cambian los datos o la hora (crear, editar, cerrar un diálogo)', () => {
    const { rerender } = render(vista())
    scrollTo.mockClear()
    const nuevo = evento('Nuevo', '2026-12-09T09:00:00-03:00', '2026-12-09T10:00:00-03:00')
    rerender(vista({ eventos: [nuevo] }))
    rerender(vista({ eventos: [nuevo], ahora: new Date('2026-12-08T15:11:00-03:00') }))
    rerender(vista({ eventos: [], listo: false }))
    rerender(vista({ eventos: [], listo: true }))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('resta el alto del banner de vencidos (--alto-vencidos)', () => {
    document.documentElement.style.setProperty('--alto-vencidos', '40px')
    render(vista())
    expect(scrollTo).toHaveBeenCalledWith({ top: 192, behavior: 'auto' })
  })

  it('las cabeceras fijas bajan por debajo del banner con la misma variable', () => {
    render(vista())
    const encabezado = within(screen.getByTestId('semana-por-horas')).getAllByRole('button', { name: /^lunes 7/ })[0]?.parentElement
    expect(encabezado).toHaveClass('sticky', 'top-[var(--alto-vencidos,0px)]')
  })
})

describe('VistaSemana: texto completo de los bloques (H-31)', () => {
  it('el botón que cubre un evento lleva el title con el texto completo (el del dibujo queda tapado)', () => {
    render(vista({ eventos: [evento('Reunión de planificación trimestral', '2026-12-08T09:00:00-03:00', '2026-12-08T10:00:00-03:00')] }))
    const boton = within(screen.getByTestId('semana-por-horas')).getByRole('button', { name: /^Editar evento: Reunión de planificación trimestral/ })
    expect(boton).toHaveAttribute('title', 'EVENTO · 09:00–10:00 — Reunión de planificación trimestral')
  })

  it('un evento en la franja «Sin hora» también lleva el texto completo; una tarea sin hora conserva el suyo', () => {
    render(
      vista({
        eventos: [evento('Congreso internacional de ingeniería', '2026-12-08T09:00:00-03:00', '2026-12-10T18:00:00-03:00')],
        tareas: [tarea({ titulo: 'ZZ-una tarea con un título larguísimo' })],
      }),
    )
    // Una franja por columna: la segunda es la del martes 8, donde empieza el congreso.
    const franja = within(screen.getAllByTestId('franja-sin-hora')[1] as HTMLElement)
    expect(franja.getByRole('button', { name: /Congreso internacional de ingeniería/ })).toHaveAttribute(
      'title',
      expect.stringContaining('Congreso internacional de ingeniería'),
    )
    expect(document.querySelector('[title="ZZ-una tarea con un título larguísimo"]')).not.toBeNull()
  })

  it('el título de dos líneas no parte palabras a mitad (sin break-words ni break-all)', () => {
    render(vista({ tareas: [tarea({ titulo: 'Trabajar en el informe', horaInicio: '09:00:00', horaFin: '10:00:00' })] }))
    const titulo = within(screen.getAllByTestId('bloque-semana')[0] as HTMLElement).getByText('Trabajar en el informe')
    expect(titulo).toHaveClass('break-normal', 'text-ellipsis')
    expect(titulo).not.toHaveClass('break-words')
    expect(titulo).not.toHaveClass('break-all')
    expect(titulo.style.overflow).toBe('hidden') // el line-clamp pone la elipsis
  })
})
