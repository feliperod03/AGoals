import type { KeyboardEvent, Ref } from 'react'

import { cn } from '@/lib/utils'
import { etiquetaDia, recortarParaCelda, type ElementoDia } from './calendario'
import { ElementoCelda } from './ElementoCelda'

interface Props {
  fecha: string
  hoy: string
  elementos: ElementoDia[]
  /** Pertenece al mes que se está viendo (si no, se atenúa). */
  delMes: boolean
  seleccionada: boolean
  alElegir: (fecha: string) => void
  alTeclear: (evento: KeyboardEvent<HTMLButtonElement>) => void
  botonRef: Ref<HTMLButtonElement>
}

/**
 * Un día de la cuadrícula. La celda entera es un solo botón (un tab stop, sin botones anidados) con la etiqueta
 * accesible completa; lo que se dibuja dentro es visual. Con ancho suficiente (640 px de cuadrícula) muestra
 * líneas (`ElementoCelda`; con 980 px, también la hora); en angosto, marcas sin texto (`aria-hidden`). El «+N más»
 * es un único elemento compartido por los niveles: la palabra «más» solo se ve desde 640 px.
 */
export function CeldaDia({ fecha, hoy, elementos, delMes, seleccionada, alElegir, alTeclear, botonRef }: Props) {
  const esHoy = fecha === hoy
  const { visibles, ocultos } = recortarParaCelda(elementos)
  const numero = Number(fecha.slice(8, 10))

  return (
    <div
      role="gridcell"
      aria-selected={seleccionada}
      className={cn('flex min-h-16 border-r border-b border-line @min-[640px]:min-h-28', seleccionada ? 'bg-side' : delMes ? 'bg-card' : 'bg-bg/60')}
    >
      <button
        ref={botonRef}
        type="button"
        tabIndex={seleccionada ? 0 : -1}
        aria-label={etiquetaDia(fecha, elementos, hoy)}
        aria-current={esHoy ? 'date' : undefined}
        onClick={() => alElegir(fecha)}
        onKeyDown={alTeclear}
        className={cn(
          'flex w-full flex-col items-stretch gap-1 p-1.5 text-left @min-[640px]:p-2',
          seleccionada && 'ring-2 ring-acc ring-inset',
        )}
      >
        <span
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center self-start rounded-full font-serif text-lg leading-none',
            esHoy ? 'bg-acc text-acc-tx' : delMes ? 'text-tx' : 'text-mut',
          )}
        >
          {numero}
        </span>

        {/* Variante ancha: una línea por elemento. */}
        <span className={cn('hidden min-w-0 flex-col gap-1 @min-[640px]:flex', !delMes && 'opacity-60')}>
          {visibles.map((e) => (
            <ElementoCelda key={e.clave} elemento={e} />
          ))}
        </span>

        {/* Variante angosta: marcas decorativas, sin texto. */}
        <span aria-hidden="true" className={cn('flex flex-wrap gap-1 @min-[640px]:hidden', !delMes && 'opacity-60')}>
          {visibles.map((e) =>
            e.tipo === 'evento' ? (
              <span key={e.clave} className="size-2.5 rounded-sm bg-evento" />
            ) : (
              <span key={e.clave} className="size-2.5 rounded-full border border-gold bg-tarea" />
            ),
          )}
        </span>

        {ocultos > 0 && (
          <span className={cn('text-xs font-medium whitespace-nowrap text-mut', !delMes && 'opacity-60')}>
            +{ocultos}
            <span className="hidden @min-[640px]:inline"> más</span>
          </span>
        )}
      </button>
    </div>
  )
}
