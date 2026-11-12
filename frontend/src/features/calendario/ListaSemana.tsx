import { useId } from 'react'

import { formatearDiaSemana } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Evento } from '@/types/evento'
import type { ElementoDia } from './calendario'
import { FilaDetalle } from './DetalleDia'

interface Props {
  dias: string[]
  hoy: string
  elementosPorDia: Map<string, ElementoDia[]>
  alAbrirEvento?: (evento: Evento) => void
}

/**
 * La semana en pantallas angostas: los siete días uno debajo del otro, cada uno con sus filas del detalle de 9a
 * (con hora primero y sin hora después, el orden de `ordenarElementos`). Las filas de evento abren su edición; aquí
 * no hay clic en huecos para crear (solo en la grilla por horas).
 */
export function ListaSemana({ dias, hoy, elementosPorDia, alAbrirEvento }: Props) {
  return (
    <div className="flex flex-col gap-5 rounded-card bg-card p-4 shadow-card">
      {dias.map((fecha) => (
        <DiaDeLaLista key={fecha} fecha={fecha} hoy={hoy} elementos={elementosPorDia.get(fecha) ?? []} alAbrirEvento={alAbrirEvento} />
      ))}
    </div>
  )
}

function DiaDeLaLista({
  fecha,
  hoy,
  elementos,
  alAbrirEvento,
}: {
  fecha: string
  hoy: string
  elementos: ElementoDia[]
  alAbrirEvento?: (evento: Evento) => void
}) {
  const id = useId()
  const esHoy = fecha === hoy
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 flex items-baseline gap-2 font-serif text-lg leading-tight">
        <span className={cn(esHoy && 'text-acc')}>{formatearDiaSemana(fecha)}</span>
        {esHoy && <span className="font-sans text-xs font-medium text-mut">hoy</span>}
      </h2>
      {elementos.length === 0 ? (
        <p className="text-sm text-mut">Nada para este día.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {elementos.map((e) => (
            <FilaDetalle key={e.clave} elemento={e} hoy={hoy} alAbrirEvento={alAbrirEvento} />
          ))}
        </ul>
      )}
    </section>
  )
}
