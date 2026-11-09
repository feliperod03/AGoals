import { Link } from 'react-router-dom'

import { PrioridadChip } from '@/components/PrioridadChip'
import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { cn } from '@/lib/utils'
import type { NodoJerarquia } from './arbol'
import { MenuAccionesItem } from './MenuAccionesItem'
import { SelectorEstado } from './SelectorEstado'
import { esAbierto, type ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'

interface Props<T extends ItemJerarquico> {
  nodos: NodoJerarquia<T>[]
  rutaBase: string
  /** «Subproyecto de»: se usa cuando el ítem sube a raíz porque su padre no cumple el filtro. */
  rotuloSubDe: string
  ocultoUno: string
  ocultoVarios: string
  /** Texto extra de la línea secundaria (p. ej. el objetivo de un proyecto); `null` = nada. */
  extra?: (item: T) => string | null
  acciones: AccionesJerarquia<T>
}

/** Ítems con sus hijos anidados. El nombre lleva al detalle; cada fila tiene su cambio rápido de estado y su menú. */
export function ListaArbol<T extends ItemJerarquico>({ nodos, ...resto }: Props<T>) {
  return (
    <ul className="flex flex-col">
      {nodos.map((nodo) => (
        <Fila key={nodo.item.id} nodo={nodo} {...resto} />
      ))}
    </ul>
  )
}

function Fila<T extends ItemJerarquico>({ nodo, ...resto }: Omit<Props<T>, 'nodos'> & { nodo: NodoJerarquia<T> }) {
  const { item, hijos, padre, ocultos } = nodo
  const { rutaBase, rotuloSubDe, ocultoUno, ocultoVarios, extra, acciones } = resto
  const cerrado = !esAbierto(item.estado)
  const adicional = extra?.(item)

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 py-2">
        {/* Decorativo: el icono viene de las tareas (su texto oculto diría «Hecha»); aquí el estado se escribe en masculino. */}
        <EstadoIcono estado={item.estado} decorativo />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex w-full min-w-0 items-center gap-3">
            <Link
              to={`${rutaBase}/${item.id}`}
              className={cn(
                'min-w-0 truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                cerrado && 'text-mut line-through',
              )}
            >
              {item.nombre}
            </Link>
            {item.prioridad && <PrioridadChip prioridad={item.prioridad} />}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs text-mut">
            {adicional && <span>{adicional}</span>}
            {padre && (
              <span>
                {rotuloSubDe} «{padre}»
              </span>
            )}
          </span>
        </div>
        <SelectorEstado item={item} acciones={acciones} />
        <MenuAccionesItem item={item} acciones={acciones} />
      </div>

      {(hijos.length > 0 || ocultos > 0) && (
        <div className="ml-6 border-l border-line pl-3">
          {hijos.length > 0 && (
            <ul className="flex flex-col">
              {hijos.map((hijo) => (
                <Fila key={hijo.item.id} nodo={hijo} {...resto} />
              ))}
            </ul>
          )}
          {ocultos > 0 && (
            <p className="py-1 text-xs text-mut">
              +{ocultos} {ocultos === 1 ? ocultoUno : ocultoVarios} por el filtro
            </p>
          )}
        </div>
      )}
    </li>
  )
}
