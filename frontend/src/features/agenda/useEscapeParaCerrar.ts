import { useEffect, useRef } from 'react'

/**
 * Mientras un panel está `abierto`, Escape lo cierra aunque el foco esté fuera de él (p. ej. en el título
 * del diálogo). Los selectores ya cierran con Escape cuando el foco está dentro (con `stopPropagation`,
 * así que ese caso no llega aquí).
 *
 * Orden con el diálogo de Radix: Radix escucha Escape en la fase de CAPTURA y lee `abiertoRef.current`
 * (aún `true`) antes de que este listener, en burbuja, cierre el panel; por eso el diálogo no se cierra
 * con ese mismo Escape. `abiertoRef` se apaga después, en el efecto del selector.
 */
export function useEscapeParaCerrar(abierto: boolean, cerrar: () => void) {
  const cerrarRef = useRef(cerrar)
  useEffect(() => {
    cerrarRef.current = cerrar
  })

  useEffect(() => {
    if (!abierto) return
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrarRef.current()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto])
}
