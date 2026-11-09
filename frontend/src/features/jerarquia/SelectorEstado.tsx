import { cn } from '@/lib/utils'
import type { Estado } from '@/types/tarea'
import { ESTADOS, ETIQUETA_ESTADO, type ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'

/**
 * Cambio rápido de estado: un `<select>` nativo (más simple y accesible que un menú con submenú). El cambio se
 * manda tal cual: no se propaga a padres ni hijos.
 */
export function SelectorEstado<T extends ItemJerarquico>({ item, acciones, className }: { item: T; acciones: AccionesJerarquia<T>; className?: string }) {
  return (
    <select
      aria-label={`Cambiar estado de «${item.nombre}»`}
      value={item.estado}
      disabled={acciones.pendiente}
      onChange={(e) => acciones.cambiarEstado(item, e.target.value as Estado)}
      className={cn(
        'rounded-full border border-input bg-background px-2.5 py-1 text-xs text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60',
        className,
      )}
    >
      {ESTADOS.map((estado) => (
        <option key={estado} value={estado}>
          {ETIQUETA_ESTADO[estado]}
        </option>
      ))}
    </select>
  )
}
