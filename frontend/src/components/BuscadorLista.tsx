import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'

/** Filas que se muestran a la vez; el resto se alcanza escribiendo en la búsqueda. */
export const MAX_FILAS_BUSCADOR = 50

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const CAMPO = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx'

export interface CandidataBuscador<T extends { id: number }> {
  item: T
  /** Lo que se busca (sin tildes ni mayúsculas) y se muestra como título de la fila. */
  texto: string
  /** Línea secundaria, para distinguir textos repetidos. */
  detalle: string
}

interface Props<T extends { id: number }> {
  idInput: string
  idPanel: string
  etiqueta: string
  candidatas: CandidataBuscador<T>[]
  /** Id de la fila vigente (se marca como actual); `null` = ninguna. */
  idActual?: number | null
  /** Fila extra al comienzo de la lista (p. ej. "Sin padre"). */
  filaInicial?: ReactNode
  /** Mensaje si nada coincide con la búsqueda. */
  textoVacio?: string
  deshabilitado?: boolean
  alElegir: (item: T) => void
}

/**
 * Búsqueda por texto (en el cliente, sin tildes ni mayúsculas) y lista de botones nativos, para elegir un
 * elemento cualquiera. Se recorre con Tab y se activa con Enter o Espacio, sin gestionar foco virtual.
 * Al montarse enfoca la búsqueda. Versión genérica de `agenda/BuscadorTareas`, que sigue usando el selector de
 * madre y el vínculo de subtareas; migrarlo a este queda para Pulido 2.
 */
export function BuscadorLista<T extends { id: number }>({
  idInput,
  idPanel,
  etiqueta,
  candidatas,
  idActual = null,
  filaInicial,
  textoVacio = 'Ninguno coincide.',
  deshabilitado = false,
  alElegir,
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef<HTMLInputElement>(null)

  useEffect(() => {
    caja.current?.focus()
  }, [])

  const coincidencias = candidatas.filter((c) => normalizarTexto(c.texto).includes(normalizarTexto(busqueda.trim())))
  const visibles = coincidencias.slice(0, MAX_FILAS_BUSCADOR)

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Dentro de un <form>, Enter enviaría el formulario.
    e.preventDefault()
    const unica = coincidencias.length === 1 ? coincidencias[0] : undefined
    if (unica && !deshabilitado) alElegir(unica.item)
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
          <FilaBuscador key={c.item.id} actual={idActual === c.item.id} deshabilitado={deshabilitado} alElegir={() => alElegir(c.item)}>
            <span className="text-sm">{c.texto}</span>
            <span className="text-xs text-mut">{c.detalle}</span>
          </FilaBuscador>
        ))}
      </ul>
      {coincidencias.length === 0 && <p className="text-sm text-mut">{textoVacio}</p>}
      {coincidencias.length > MAX_FILAS_BUSCADOR && (
        <p className="text-sm text-mut">
          Mostrando {MAX_FILAS_BUSCADOR} de {coincidencias.length}: escribe para acotar.
        </p>
      )}
    </div>
  )
}

export function FilaBuscador({
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
