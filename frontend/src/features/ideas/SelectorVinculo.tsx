import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'

import { BuscadorLista, type CandidataBuscador } from '@/components/BuscadorLista'
import { Button } from '@/components/ui/button'
import type { ItemJerarquico } from '@/features/jerarquia/tipos'

interface Props<T extends ItemJerarquico> {
  /** «proyecto» / «objetivo»: para los textos. */
  tipo: 'proyecto' | 'objetivo'
  /** Nombre del elegido (o del actual); `null` = ninguno todavía. */
  nombreActual: string | null
  idActual: number | null
  /** `undefined` mientras la lista no está disponible. */
  candidatos: CandidataBuscador<T>[] | undefined
  deshabilitado: boolean
  /** Texto de ayuda o error bajo el campo (p. ej. si la lista no cargó). */
  nota?: string
  /** El diálogo lo lee para no cerrarse con Escape mientras el selector está abierto. */
  abiertoRef: MutableRefObject<boolean>
  alElegir: (id: number, nombre: string) => void
}

/**
 * Elige un proyecto u objetivo para la idea: valor actual + botón «Cambiar»/«Elegir» que abre una búsqueda por
 * nombre. Misma idea que `jerarquia/SelectorPadre` (que no se generalizó para no tocar esa carpeta).
 */
export function SelectorVinculo<T extends ItemJerarquico>({ tipo, nombreActual, idActual, candidatos, deshabilitado, nota, abiertoRef, alElegir }: Props<T>) {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState('')
  const boton = useRef<HTMLButtonElement>(null)
  const etiqueta = tipo === 'proyecto' ? 'Proyecto' : 'Objetivo'

  useEffect(() => {
    abiertoRef.current = abierto
    return () => {
      abiertoRef.current = false
    }
  }, [abierto, abiertoRef])

  function cerrar() {
    setAbierto(false)
    boton.current?.focus()
  }

  function elegir(id: number, nombre: string) {
    alElegir(id, nombre)
    setAviso(`${etiqueta} elegido: «${nombre}»`)
    cerrar()
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && abierto) {
      e.stopPropagation()
      cerrar()
    }
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={alTeclear}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{etiqueta}</span>
          <span data-testid="vinculo-actual" className="text-sm">
            {nombreActual === null ? `Sin ${tipo} elegido` : `«${nombreActual}»`}
          </span>
        </div>
        <Button
          ref={boton}
          type="button"
          variant="secondary"
          size="sm"
          disabled={deshabilitado}
          aria-expanded={abierto}
          aria-controls="idea-vinculo-panel"
          onClick={() => (abierto ? cerrar() : setAbierto(true))}
        >
          {nombreActual === null ? 'Elegir' : 'Cambiar'}
        </Button>
      </div>

      {nota && <p className="text-xs text-mut">{nota}</p>}

      {/* Región viva propia: Radix deja el resto de la página con aria-hidden mientras el diálogo está abierto. */}
      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {abierto && (
        <BuscadorLista
          idInput="idea-vinculo-buscar"
          idPanel="idea-vinculo-panel"
          etiqueta={`Buscar ${tipo}`}
          candidatas={candidatos ?? []}
          idActual={idActual}
          textoVacio={`Ningún ${tipo} coincide.`}
          alElegir={(item) => elegir(item.id, item.nombre)}
        />
      )}
    </div>
  )
}
