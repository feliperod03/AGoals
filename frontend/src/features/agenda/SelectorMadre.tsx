import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'

import { Button } from '@/components/ui/button'
import { BuscadorTareas, Fila } from './BuscadorTareas'
import type { CandidataMadre } from './candidatasMadre'

export { MAX_FILAS } from './BuscadorTareas'

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

/**
 * Selector de madre: valor actual + botón "Cambiar" que abre una búsqueda por título (en el cliente) y una
 * lista de botones nativos. Se recorre con Tab y se activa con Enter o Espacio, sin gestionar foco virtual.
 */
export function SelectorMadre({ tituloActual, idActual, candidatas, deshabilitado, nota, abiertoRef, alElegir }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState('')
  const botonCambiar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    abiertoRef.current = abierto
    return () => {
      abiertoRef.current = false
    }
  }, [abierto, abiertoRef])

  function cerrar() {
    setAbierto(false)
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
        <BuscadorTareas
          idInput="tarea-madre-buscar"
          idPanel="tarea-madre-panel"
          etiqueta="Buscar madre"
          candidatas={candidatas ?? []}
          idActual={idActual}
          filaInicial={
            <Fila actual={idActual === null} alElegir={() => elegir(null, null)}>
              <span className="text-sm">Sin madre</span>
            </Fila>
          }
          alElegir={(tarea) => elegir(tarea.id, tarea.titulo)}
        />
      )}
    </div>
  )
}
