import { cn } from '@/lib/utils'
import type { Vista } from './calendario'

const OPCIONES: { vista: Vista; texto: string }[] = [
  { vista: 'mes', texto: 'Mes' },
  { vista: 'semana', texto: 'Semana' },
]

/** «Mes | Semana»: dos botones con `aria-pressed` en un grupo con nombre (no es un radio: cada uno navega). */
export function SelectorVista({ vista, alCambiar }: { vista: Vista; alCambiar: (vista: Vista) => void }) {
  return (
    <div role="group" aria-label="Vista" className="inline-flex rounded-full border border-line bg-card p-0.5">
      {OPCIONES.map((opcion) => {
        const activa = opcion.vista === vista
        return (
          <button
            key={opcion.vista}
            type="button"
            aria-pressed={activa}
            onClick={() => alCambiar(opcion.vista)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              activa ? 'bg-acc text-acc-tx' : 'text-tx hover:bg-line/60',
            )}
          >
            {opcion.texto}
          </button>
        )
      })}
    </div>
  )
}
