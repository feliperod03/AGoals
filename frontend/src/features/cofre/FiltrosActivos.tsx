import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { FOCO } from './estilos'
import type { FiltroActivo } from './filtros'

interface Props {
  chips: FiltroActivo[]
  alQuitar: (chip: FiltroActivo) => void
}

/** Fila de chips con los filtros activos que no tienen un acceso rápido encendido. Se ve aunque «Más filtros» esté plegado. */
export function FiltrosActivos({ chips, alQuitar }: Props) {
  if (chips.length === 0) return null
  return (
    <ul aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.dimension} className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-0.5 pr-0.5 pl-3 text-sm text-tx">
          {chip.texto}
          <button
            type="button"
            aria-label={`Quitar filtro: ${chip.texto}`}
            onClick={() => alQuitar(chip)}
            className={cn('inline-flex size-6 items-center justify-center rounded-full text-mut hover:bg-muted hover:text-tx', FOCO)}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
