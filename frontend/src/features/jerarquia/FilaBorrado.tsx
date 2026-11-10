import { useId } from 'react'

import { cn } from '@/lib/utils'
import type { Eleccion } from '@/types/impactoBorrado'

interface Props {
  /** «Tareas (3)»: nombra al grupo para los lectores de pantalla. */
  titulo: string
  eleccion: Eleccion
  alElegir: (eleccion: Eleccion) => void
  /** Qué pasa con la elección actual («Quedan sueltas», «Se borran 5 tareas»). */
  ayuda: string
  deshabilitada: boolean
}

const OPCIONES: { valor: Eleccion; etiqueta: string }[] = [
  { valor: 'conservar', etiqueta: 'Mover' },
  { valor: 'borrar', etiqueta: 'Borrar' },
]

/** Una categoría del borrado: interruptor Mover / Borrar con radios nativos y el texto de lo que pasa con cada uno. */
export function FilaBorrado({ titulo, eleccion, alElegir, ayuda, deshabilitada }: Props) {
  const id = useId()
  const idAyuda = `${id}-ayuda`
  return (
    <fieldset disabled={deshabilitada} className="flex flex-col gap-1.5 rounded-xl border border-line px-3 py-2">
      <legend className="px-1 text-sm font-medium text-tx">{titulo}</legend>
      <div className="flex gap-2">
        {OPCIONES.map(({ valor, etiqueta }) => {
          const marcada = eleccion === valor
          return (
            <label
              key={valor}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm has-[:disabled]:cursor-default has-[:disabled]:opacity-50',
                marcada ? (valor === 'borrar' ? 'border-alta bg-alta/10 text-alta' : 'border-ring bg-muted text-tx') : 'border-input text-mut',
              )}
            >
              <input
                type="radio"
                name={id}
                value={valor}
                checked={marcada}
                onChange={() => alElegir(valor)}
                aria-describedby={idAyuda}
                className={valor === 'borrar' ? 'accent-alta' : 'accent-acc'}
              />
              {etiqueta}
            </label>
          )
        })}
      </div>
      <p id={idAyuda} className="text-xs text-mut">
        {ayuda}
      </p>
    </fieldset>
  )
}
