import { Link } from 'react-router-dom'

import { PrioridadChip } from '@/components/PrioridadChip'
import { cn } from '@/lib/utils'
import { ETIQUETA_ESTADO, esAbierto, type ItemJerarquico } from './tipos'

/** Lista plana y de solo lectura de proyectos u objetivos: nombre (enlace al detalle), estado y prioridad. */
export function ListaEnlaces<T extends ItemJerarquico>({ items, rutaBase }: { items: T[]; rutaBase: string }) {
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
          <Link
            to={`${rutaBase}/${item.id}`}
            className={cn(
              'min-w-0 flex-1 truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              !esAbierto(item.estado) && 'text-mut line-through',
            )}
          >
            {item.nombre}
          </Link>
          {item.prioridad && <PrioridadChip prioridad={item.prioridad} />}
          <span className="text-xs text-mut">{ETIQUETA_ESTADO[item.estado]}</span>
        </li>
      ))}
    </ul>
  )
}
