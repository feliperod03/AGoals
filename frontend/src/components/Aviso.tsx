import { X } from 'lucide-react'
import type { FocusEvent } from 'react'

import { cn } from '@/lib/utils'

interface Props {
  mensaje: string
  /** Fase de salida: la burbuja se desvanece antes de desmontarse (la controla el hook con un temporizador). */
  saliendo: boolean
  alCerrar: () => void
  alPausar: () => void
  alReanudar: () => void
}

/**
 * Aviso de confirmación flotante (abajo a la derecha; abajo y centrado en pantallas angostas).
 *
 * La región viva (`role="status"`) está SIEMPRE en el DOM, aunque vacía, y solo cambia su texto: una región
 * que aparece junto con su contenido no se anuncia. Es la única de la página; el botón «×» queda fuera de ella.
 * Las animaciones de movimiento llevan `motion-safe:`: con "reducir movimiento" queda solo el fundido.
 * El contenedor no captura clics (`pointer-events-none`); solo la burbuja, que además queda por encima del
 * overlay de los diálogos (`z-[60]` > `z-50`).
 */
export function Aviso({ mensaje, saliendo, alCerrar, alPausar, alReanudar }: Props) {
  // Cambiar de un hijo a otro de la burbuja no es "salir": solo se reanuda al irse del todo.
  const alSalirElFoco = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) alReanudar()
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] max-sm:inset-x-4 max-sm:flex max-sm:justify-center">
      <div
        data-estado={saliendo ? 'saliendo' : 'visible'}
        className={cn(
          mensaje
            ? [
                'pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border border-line bg-card py-2.5 pr-2 pl-4 text-sm text-tx shadow-card',
                'motion-safe:animate-in motion-safe:slide-in-from-bottom-2 fade-in duration-200',
                'transition-opacity data-[estado=saliendo]:opacity-0 motion-safe:transition-[opacity,translate] motion-safe:data-[estado=saliendo]:translate-y-2',
              ]
            : 'sr-only',
        )}
        // El clic en «×» no debe contar como "clic fuera" para el diálogo modal de Radix que haya abierto.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerEnter={alPausar}
        onPointerLeave={alReanudar}
        onFocus={alPausar}
        onBlur={alSalirElFoco}
      >
        <p role="status" aria-live="polite" className="py-0.5">
          {mensaje}
        </p>
        {mensaje && (
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={alCerrar}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-mut hover:bg-muted hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
