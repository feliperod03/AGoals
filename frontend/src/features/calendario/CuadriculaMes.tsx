import { useEffect, useRef, type KeyboardEvent } from 'react'

import { mesDe, nombresDiasSemana, semanasDelMes } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import { diaDestino, type ElementoDia } from './calendario'
import { CeldaDia } from './CeldaDia'

const DIAS_SEMANA = nombresDiasSemana()

interface Props {
  mes: string
  hoy: string
  /** Día seleccionado: el único que entra en el orden de Tab (roving tabindex). */
  dia: string
  elementosPorDia: Map<string, ElementoDia[]>
  /** Id del título del mes, que da nombre a la cuadrícula. */
  etiquetadaPor: string
  /** Un día de esta cuadrícula (clic o tecla que no sale de ella). */
  alSeleccionar: (fecha: string) => void
  /** Una tecla que lleva a un día fuera de esta cuadrícula: cambia de mes. */
  alSaltar: (fecha: string) => void
  /** Atajo de mouse (9c): un clic sobre el chip de un evento, además de seleccionar el día, abre su edición. */
  alAbrirEvento?: (evento: Evento) => void
}

/**
 * Cuadrícula mensual (lunes a domingo) como `grid` accesible: una fila por semana y una celda por día. Teclado:
 * flechas ±1 día / ±7, Inicio y Fin = lunes y domingo, RePág y AvPág = mes anterior y siguiente.
 */
export function CuadriculaMes({ mes, hoy, dia, elementosPorDia, etiquetadaPor, alSeleccionar, alSaltar, alAbrirEvento }: Props) {
  const semanas = semanasDelMes(mes)
  const botones = useRef(new Map<string, HTMLButtonElement>())
  // Solo se mueve el foco cuando el cambio de día vino del teclado (un clic ya deja el foco en su botón).
  const enfocarAlCambiar = useRef(false)

  useEffect(() => {
    if (!enfocarAlCambiar.current) return
    enfocarAlCambiar.current = false
    botones.current.get(dia)?.focus()
  }, [dia, mes])

  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>) {
    // Alt+flecha, Ctrl+Inicio, etc. son atajos del navegador.
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return
    const destino = diaDestino(dia, evento.key)
    if (destino === null) return
    evento.preventDefault()
    enfocarAlCambiar.current = true
    if (semanas.some((semana) => semana.includes(destino))) alSeleccionar(destino)
    else alSaltar(destino)
  }

  return (
    <div role="grid" aria-labelledby={etiquetadaPor} className="@container overflow-hidden rounded-card bg-card shadow-card">
      <div role="row" className="grid grid-cols-7 border-b border-line">
        {DIAS_SEMANA.map(({ corto, largo }) => (
          <div key={largo} role="columnheader" className="py-2 text-center text-xs font-medium text-mut">
            <abbr title={largo} className="no-underline">
              {corto}
            </abbr>
          </div>
        ))}
      </div>
      {semanas.map((semana) => (
        <div key={semana[0]} role="row" className="grid grid-cols-7">
          {semana.map((fecha) => (
            <CeldaDia
              key={fecha}
              fecha={fecha}
              hoy={hoy}
              elementos={elementosPorDia.get(fecha) ?? []}
              delMes={mesDe(fecha) === mes}
              seleccionada={fecha === dia}
              alElegir={alSeleccionar}
              alAbrirEvento={alAbrirEvento}
              alTeclear={alTeclear}
              botonRef={(boton) => {
                if (boton) botones.current.set(fecha, boton)
                else botones.current.delete(fecha)
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
