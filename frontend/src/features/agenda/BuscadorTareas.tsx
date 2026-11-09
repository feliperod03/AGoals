import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'
import type { Tarea } from '@/types/tarea'
import type { CandidataMadre } from './candidatasMadre'

/** Filas que se muestran a la vez; el resto se alcanza escribiendo en la búsqueda. */
export const MAX_FILAS = 50

export const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const CAMPO = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx'

interface Props {
  idInput: string
  idPanel: string
  etiqueta: string
  candidatas: CandidataMadre[]
  /** Id de la fila vigente (se marca como actual); `null` = ninguna. */
  idActual?: number | null
  /** Fila extra al comienzo de la lista (p. ej. "Sin madre"). */
  filaInicial?: ReactNode
  deshabilitado?: boolean
  alElegir: (tarea: Tarea) => void
}

/**
 * Búsqueda por título (en el cliente, sin tildes ni mayúsculas) y lista de botones nativos. Se recorre
 * con Tab y se activa con Enter o Espacio, sin gestionar foco virtual. Al montarse enfoca la búsqueda.
 * Compartido por el selector de madre (8.2f) y el vínculo de subtareas (8.2g).
 */
export function BuscadorTareas({ idInput, idPanel, etiqueta, candidatas, idActual = null, filaInicial, deshabilitado = false, alElegir }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef<HTMLInputElement>(null)

  useEffect(() => {
    caja.current?.focus()
  }, [])

  const coincidencias = candidatas.filter((c) => normalizarTexto(c.tarea.titulo).includes(normalizarTexto(busqueda.trim())))
  const visibles = coincidencias.slice(0, MAX_FILAS)

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Dentro de un <form>, Enter enviaría el formulario.
    e.preventDefault()
    const unica = coincidencias.length === 1 ? coincidencias[0] : undefined
    if (unica && !deshabilitado) alElegir(unica.tarea)
  }

  return (
    <div id={idPanel} className="flex flex-col gap-2">
      <label htmlFor={idInput} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={idInput}
        ref={caja}
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={alTeclear}
        className={cn(CAMPO, FOCO)}
      />
      <ul className="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-line">
        {filaInicial}
        {visibles.map((c) => (
          <Fila key={c.tarea.id} actual={idActual === c.tarea.id} deshabilitado={deshabilitado} alElegir={() => alElegir(c.tarea)}>
            <span className="text-sm">{c.tarea.titulo}</span>
            <span className="text-xs text-mut">{c.detalle}</span>
          </Fila>
        ))}
      </ul>
      {coincidencias.length === 0 && <p className="text-sm text-mut">Ninguna tarea coincide.</p>}
      {coincidencias.length > MAX_FILAS && (
        <p className="text-sm text-mut">
          Mostrando {MAX_FILAS} de {coincidencias.length}: escribe para acotar.
        </p>
      )}
    </div>
  )
}

export function Fila({
  actual,
  deshabilitado = false,
  alElegir,
  children,
}: {
  actual: boolean
  deshabilitado?: boolean
  alElegir: () => void
  children: ReactNode
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        disabled={deshabilitado}
        aria-current={actual ? 'true' : undefined}
        onClick={alElegir}
        className={cn('flex w-full flex-col px-3 py-2 text-left hover:bg-muted disabled:opacity-60', FOCO, actual && 'bg-muted font-medium')}
      >
        {children}
        {actual && <span className="sr-only"> (actual)</span>}
      </button>
    </li>
  )
}
