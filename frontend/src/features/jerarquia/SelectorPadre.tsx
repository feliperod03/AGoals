import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'

import { BuscadorLista, FilaBuscador } from '@/components/BuscadorLista'
import { Button } from '@/components/ui/button'
import type { CandidatoPadre } from './candidatosPadre'
import type { ItemJerarquico } from './tipos'

interface Props<T extends ItemJerarquico> {
  /** Nombre del padre vigente (actual o elegido); `null` = sin padre. */
  nombreActual: string | null
  /** Id del padre vigente; `null` = sin padre. */
  idActual: number | null
  /** `undefined` mientras la lista no está disponible. */
  candidatos: CandidatoPadre<T>[] | undefined
  deshabilitado: boolean
  /** Texto de ayuda o error bajo el campo (p. ej. si la lista no cargó). */
  nota?: string
  textoVacio: string
  /** El diálogo lo lee para no cerrarse con Escape mientras el selector está abierto. */
  abiertoRef: MutableRefObject<boolean>
  alElegir: (id: number | null, nombre: string | null) => void
}

/**
 * Campo "Padre" de proyectos y objetivos: valor actual + botón "Cambiar" que abre una búsqueda por nombre.
 * Misma idea que `agenda/SelectorMadre` (que sigue siendo solo de tareas, con sus textos fijos).
 */
export function SelectorPadre<T extends ItemJerarquico>({ nombreActual, idActual, candidatos, deshabilitado, nota, textoVacio, abiertoRef, alElegir }: Props<T>) {
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

  function elegir(id: number | null, nombre: string | null) {
    alElegir(id, nombre)
    setAviso(nombre === null ? 'Sin padre' : `Padre elegido: «${nombre}»`)
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
          <span className="text-sm font-medium">Padre</span>
          <span data-testid="padre-actual" className="text-sm">
            {nombreActual === null ? 'Sin padre' : `«${nombreActual}»`}
          </span>
        </div>
        <Button
          ref={botonCambiar}
          type="button"
          variant="secondary"
          size="sm"
          disabled={deshabilitado}
          aria-expanded={abierto}
          aria-controls="item-padre-panel"
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
        <BuscadorLista
          idInput="item-padre-buscar"
          idPanel="item-padre-panel"
          etiqueta="Buscar padre"
          candidatas={candidatos ?? []}
          idActual={idActual}
          textoVacio={textoVacio}
          filaInicial={
            <FilaBuscador actual={idActual === null} alElegir={() => elegir(null, null)}>
              <span className="text-sm">Sin padre</span>
            </FilaBuscador>
          }
          alElegir={(item) => elegir(item.id, item.nombre)}
        />
      )}
    </div>
  )
}
