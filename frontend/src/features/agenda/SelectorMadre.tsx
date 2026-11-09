import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { normalizarTexto } from '@/lib/texto'
import { cn } from '@/lib/utils'
import type { CandidataMadre } from './candidatasMadre'

/** Filas que se muestran a la vez; el resto se alcanza escribiendo en la búsqueda. */
export const MAX_FILAS = 50

interface Props {
  /** Texto de la selección vigente (título de la madre actual o elegida). */
  tituloActual: string | null
  /** Id de la selección vigente; `null` = sin madre. */
  idActual: number | null
  /** `undefined` mientras la lista no está disponible. */
  candidatas: CandidataMadre[] | undefined
  deshabilitado: boolean
  /** Texto de ayuda o error bajo el campo (p. ej. si la lista no cargó). */
  nota?: string
  /** El diálogo lo lee para no cerrarse con Escape mientras el selector está abierto. */
  abiertoRef: MutableRefObject<boolean>
  alElegir: (id: number | null, titulo: string | null) => void
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
const CAMPO = 'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx'

/**
 * Selector de madre: valor actual + botón "Cambiar" que abre una búsqueda por título (en el cliente) y una
 * lista de botones nativos. Se recorre con Tab y se activa con Enter o Espacio, sin gestionar foco virtual.
 */
export function SelectorMadre({ tituloActual, idActual, candidatas, deshabilitado, nota, abiertoRef, alElegir }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState('')
  const botonCambiar = useRef<HTMLButtonElement>(null)
  const cajaBusqueda = useRef<HTMLInputElement>(null)

  useEffect(() => {
    abiertoRef.current = abierto
    if (abierto) cajaBusqueda.current?.focus()
    return () => {
      abiertoRef.current = false
    }
  }, [abierto, abiertoRef])

  const coincidencias = (candidatas ?? []).filter((c) => normalizarTexto(c.tarea.titulo).includes(normalizarTexto(busqueda.trim())))
  const visibles = coincidencias.slice(0, MAX_FILAS)

  function cerrar() {
    setAbierto(false)
    setBusqueda('')
    botonCambiar.current?.focus()
  }

  function elegir(id: number | null, titulo: string | null) {
    alElegir(id, titulo)
    setAviso(titulo === null ? 'Sin madre' : `Madre elegida: «${titulo}»`)
    cerrar()
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrar()
    }
  }

  function alTeclearBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Dentro de un <form>, Enter enviaría el formulario.
    e.preventDefault()
    const unica = coincidencias.length === 1 ? coincidencias[0] : undefined
    if (unica) elegir(unica.tarea.id, unica.tarea.titulo)
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={alTeclear}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Madre</span>
          <span data-testid="madre-actual" className="text-sm">
            {tituloActual === null ? 'Sin madre' : `«${tituloActual}»`}
          </span>
        </div>
        <Button
          ref={botonCambiar}
          type="button"
          variant="secondary"
          size="sm"
          disabled={deshabilitado}
          aria-expanded={abierto}
          aria-controls="tarea-madre-panel"
          onClick={() => (abierto ? cerrar() : setAbierto(true))}
        >
          Cambiar
        </Button>
      </div>

      {nota && <p className="text-xs text-mut">{nota}</p>}

      {/* Región viva propia: Radix deja el resto de la página con aria-hidden mientras el diálogo está abierto. */}
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {abierto && (
        <div id="tarea-madre-panel" className="flex flex-col gap-2">
          <label htmlFor="tarea-madre-buscar" className="text-sm font-medium">
            Buscar madre
          </label>
          <input
            id="tarea-madre-buscar"
            ref={cajaBusqueda}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={alTeclearBusqueda}
            className={cn(CAMPO, FOCO)}
          />
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-xl border border-line">
            <Fila actual={idActual === null} alElegir={() => elegir(null, null)}>
              <span className="text-sm">Sin madre</span>
            </Fila>
            {visibles.map((c) => (
              <Fila key={c.tarea.id} actual={idActual === c.tarea.id} alElegir={() => elegir(c.tarea.id, c.tarea.titulo)}>
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
      )}
    </div>
  )
}

function Fila({ actual, alElegir, children }: { actual: boolean; alElegir: () => void; children: ReactNode }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-current={actual ? 'true' : undefined}
        onClick={alElegir}
        className={cn('flex w-full flex-col px-3 py-2 text-left hover:bg-muted', FOCO, actual && 'bg-muted font-medium')}
      >
        {children}
        {actual && <span className="sr-only"> (actual)</span>}
      </button>
    </li>
  )
}
