import { X } from 'lucide-react'
import { useState } from 'react'

import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'
import type { FiltroVinculo as Filtro } from './useRecomendacion'

interface Opcion {
  id: number
  nombre: string
}

interface Props {
  filtro: Filtro
  alCambiar: (filtro: Filtro) => void
  proyectos: Opcion[] | undefined
  objetivos: Opcion[] | undefined
  /** Mensaje si falló la carga de proyectos u objetivos. */
  error: string | null
  deshabilitado: boolean
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const BOTON = 'rounded-full border px-3 py-1 text-sm disabled:opacity-60'

/**
 * Filtro por vínculo directo: Todos / Proyecto / Objetivo. Al elegir un tipo se busca por nombre en una
 * lista simple (filtrada en el cliente); elegir uno la reemplaza por un chip con "×" para quitarlo.
 */
export function FiltroVinculo({ filtro, alCambiar, proyectos, objetivos, error, deshabilitado }: Props) {
  // Tipo cuyo buscador está abierto aunque todavía no haya nada elegido.
  const [tipoElegido, setTipoElegido] = useState<'proyecto' | 'objetivo' | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const tipo = filtro?.tipo ?? tipoElegido
  const opciones = (tipo === 'proyecto' ? proyectos : objetivos) ?? []
  const elegida = filtro ? opciones.find((o) => o.id === filtro.id) : undefined
  const visibles = opciones.filter((o) => normalizarTexto(o.nombre).includes(normalizarTexto(busqueda)))

  function elegirTipo(nuevo: 'proyecto' | 'objetivo' | null) {
    setTipoElegido(nuevo)
    setBusqueda('')
    alCambiar(null)
  }

  const boton = (activo: boolean) => cn(BOTON, FOCO, activo ? 'border-acc bg-acc text-acc-tx' : 'border-line bg-card hover:bg-muted')

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Filtrar por" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-mut" aria-hidden="true">
          Filtrar por
        </span>
        <button type="button" aria-pressed={tipo === null} className={boton(tipo === null)} disabled={deshabilitado} onClick={() => elegirTipo(null)}>
          Todos
        </button>
        <button type="button" aria-pressed={tipo === 'proyecto'} className={boton(tipo === 'proyecto')} disabled={deshabilitado} onClick={() => elegirTipo('proyecto')}>
          Proyecto
        </button>
        <button type="button" aria-pressed={tipo === 'objetivo'} className={boton(tipo === 'objetivo')} disabled={deshabilitado} onClick={() => elegirTipo('objetivo')}>
          Objetivo
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {error}
        </p>
      )}

      {tipo && filtro && (
        <p className="inline-flex w-fit items-center gap-1 rounded-full border border-line bg-muted py-0.5 pr-1 pl-3 text-sm">
          <span>{elegida?.nombre ?? `${tipo === 'proyecto' ? 'Proyecto' : 'Objetivo'} ${filtro.id}`}</span>
          <button
            type="button"
            aria-label={`Quitar filtro «${elegida?.nombre ?? filtro.id}»`}
            disabled={deshabilitado}
            onClick={() => elegirTipo(null)}
            className={cn('inline-flex size-6 items-center justify-center rounded-full hover:bg-line', FOCO)}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </p>
      )}

      {tipo && !filtro && (
        <div className="flex flex-col gap-2">
          <label htmlFor="recomendacion-buscar" className="text-sm font-medium">
            {tipo === 'proyecto' ? 'Buscar proyecto' : 'Buscar objetivo'}
          </label>
          <input
            id="recomendacion-buscar"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          {visibles.length === 0 ? (
            <p className="text-sm text-mut">{opciones.length === 0 ? 'No hay nada para elegir.' : 'Ningún nombre coincide.'}</p>
          ) : (
            <ul className="flex max-h-40 flex-col overflow-y-auto rounded-xl border border-line">
              {visibles.map((o) => (
                <li key={o.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    disabled={deshabilitado}
                    onClick={() => alCambiar({ tipo, id: o.id })}
                    className={cn('w-full px-3 py-2 text-left text-sm hover:bg-muted', FOCO)}
                  >
                    {o.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
